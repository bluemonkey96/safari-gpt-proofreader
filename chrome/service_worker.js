// Polyfill alert for MV3 service worker context by messaging the active tab content script.
if (typeof self.alert !== 'function') {
  self.alert = function(message) {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to query active tab for alert:', chrome.runtime.lastError);
        return;
      }
      const tab = tabs && tabs[0];
      if (tab && typeof tab.id === 'number') {
        chrome.tabs.sendMessage(tab.id, { message });
      }
    });
  };
}

// Provide a compat layer for the deprecated chrome.tabs.executeScript used by the Safari background script.
if (!chrome.tabs.executeScript) {
  chrome.tabs.executeScript = function(injection, callback) {
    const runInjection = (tabId) => {
      if (!tabId && tabId !== 0) {
        console.error('No tabId available for script execution.');
        if (typeof callback === 'function') {
          callback();
        }
        return;
      }

      const target = { tabId };
      if (injection && injection.allFrames) {
        target.allFrames = injection.allFrames;
      }

      if (injection && injection.code) {
        chrome.scripting.executeScript(
          {
            target,
            func: (code) => {
              try {
                // eslint-disable-next-line no-eval
                eval(code);
              } catch (error) {
                console.error('Error executing injected code:', error);
              }
            },
            args: [injection.code]
          },
          callback
        );
      } else if (injection && (injection.file || injection.files)) {
        const files = injection.files || [injection.file];
        chrome.scripting.executeScript(
          {
            target,
            files
          },
          callback
        );
      } else if (typeof callback === 'function') {
        callback();
      }
    };

    if (injection && typeof injection.tabId === 'number') {
      runInjection(injection.tabId);
    } else {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to query active tab for executeScript:', chrome.runtime.lastError);
          if (typeof callback === 'function') {
            callback();
          }
          return;
        }
        const tab = tabs && tabs[0];
        runInjection(tab ? tab.id : undefined);
      });
    }
  };
}

// Load the existing background logic so Safari and Chrome share the same code.
importScripts('./background.js');

const OPENAI_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_TONE = 'Neutral';
const VALID_TONES = new Map([
  ['formal', 'Formal'],
  ['neutral', 'Neutral'],
  ['friendly', 'Friendly'],
]);
const BADGE_ERROR_TEXT = '!';
const BADGE_ERROR_COLOR = '#d93025';

function getBadgeApi() {
  if (chrome.action && typeof chrome.action.setBadgeText === 'function') {
    return chrome.action;
  }
  if (chrome.browserAction && typeof chrome.browserAction.setBadgeText === 'function') {
    return chrome.browserAction;
  }
  return null;
}

function setBadge(text, color) {
  const badgeApi = getBadgeApi();
  if (!badgeApi) {
    return;
  }

  badgeApi.setBadgeText({ text });
  if (color && typeof badgeApi.setBadgeBackgroundColor === 'function') {
    badgeApi.setBadgeBackgroundColor({ color });
  }
}

function setStorageErrorBadge() {
  setBadge(BADGE_ERROR_TEXT, BADGE_ERROR_COLOR);
}

function clearStorageErrorBadge() {
  setBadge('');
}

function safeStorageGet(keys, onSuccess, onError) {
  chrome.storage.local.get(keys, (result) => {
    const error = chrome.runtime.lastError;
    if (error) {
      console.error('Failed to access extension storage:', error);
      setStorageErrorBadge();
      if (typeof onError === 'function') {
        onError(error);
      }
      return;
    }

    clearStorageErrorBadge();
    onSuccess(result);
  });
}

if (typeof proofreadText === 'function') {
  const originalShowErrorMessage =
    typeof showErrorMessage === 'function'
      ? showErrorMessage
      : (message) => {
          console.error(message);
        };

  const originalReplaceSelectedText =
    typeof replaceSelectedText === 'function'
      ? replaceSelectedText
      : () => {};

  self.proofreadText = function mv3ProofreadText(selectedText, tabId) {
    const targetTabId = typeof tabId === 'number' ? tabId : null;
    const originalSelection = typeof selectedText === 'string' ? selectedText : '';

    safeStorageGet(
      ['openai_api_key', 'tone_preference'],
      (result) => {
        const apiKey = result.openai_api_key;
        const storedTone =
          typeof result.tone_preference === 'string' ? result.tone_preference.trim() : '';
        const normalizedTone = storedTone.toLowerCase();
        const tonePreference =
          storedTone && VALID_TONES.has(normalizedTone)
            ? VALID_TONES.get(normalizedTone)
            : DEFAULT_TONE;
        const toneInstruction = tonePreference.toLowerCase();

        if (typeof selectedText !== 'string' || !selectedText.trim()) {
          originalShowErrorMessage('No text was selected to proofread.');
          return;
        }

        if (!apiKey) {
          originalShowErrorMessage(
            'No API Key found. Please set your API Key in the extension settings.'
          );
          return;
        }

        const messages = [
          {
            role: 'system',
            content: `You are a helpful assistant. Please proofread the following text and respond in a ${toneInstruction} tone.`,
          },
          { role: 'user', content: selectedText },
        ];

        fetch(OPENAI_COMPLETIONS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages,
            max_tokens: 500,
          }),
        })
          .then(async (response) => {
            const payload = await response.json();
            if (!response.ok) {
              const message = payload?.error?.message || response.statusText;
              throw new Error(message || 'OpenAI API request failed.');
            }
            return payload;
          })
          .then((data) => {
            if (data.error) {
              console.error('OpenAI API Error:', data.error.message);
              originalShowErrorMessage(
                `OpenAI API Error: ${data.error.message}`
              );
              return;
            }

            const proofreadResult = data?.choices?.[0]?.message?.content;
            if (proofreadResult) {
              originalReplaceSelectedText(targetTabId, originalSelection, proofreadResult);
            } else {
              originalShowErrorMessage(
                'Failed to retrieve a valid proofread response from OpenAI.'
              );
            }
          })
          .catch((error) => {
            console.error('Error in proofreadText function:', error);
            const fallbackMessage =
              typeof error?.message === 'string' && error.message.trim()
                ? `Failed to proofread the text: ${error.message}`
                : 'Failed to proofread the text. Please try again.';
            originalShowErrorMessage(fallbackMessage);
          });
      },
      () => {
        originalShowErrorMessage(
          'Failed to read your extension settings. Please try again.'
        );
      }
    );
  };

  // Ensure the global binding also points at the MV3-aware implementation.
  proofreadText = self.proofreadText; // eslint-disable-line no-global-assign
}

chrome.runtime.onMessage.addListener((request) => {
  if (!request || request.type !== 'storageBadge') {
    return;
  }

  if (request.state === 'error') {
    setStorageErrorBadge();
  } else if (request.state === 'clear') {
    clearStorageErrorBadge();
  }
});
