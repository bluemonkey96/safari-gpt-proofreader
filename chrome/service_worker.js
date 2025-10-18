const BADGE_FALLBACK_TEXT = '!';
const BADGE_FALLBACK_COLOR = '#d93025';
const BADGE_FALLBACK_TIMEOUT_MS = 8000;
const BADGE_FALLBACK_TITLE_PREFIX = 'Proofreader error – ';
const DEFAULT_ACTION_TITLE = 'GPT Proofreader';

let badgeFallbackTimeoutId;

function getActionApi() {
  return chrome.action && typeof chrome.action.setBadgeText === 'function'
    ? chrome.action
    : chrome.browserAction;
}

function scheduleBadgeClear(actionApi) {
  if (badgeFallbackTimeoutId) {
    clearTimeout(badgeFallbackTimeoutId);
  }

  badgeFallbackTimeoutId = setTimeout(() => {
    actionApi.setBadgeText({ text: '' });
    if (typeof actionApi.setTitle === 'function') {
      actionApi.setTitle({ title: DEFAULT_ACTION_TITLE });
    }
  }, BADGE_FALLBACK_TIMEOUT_MS);
}

function showBadgeFallback(message) {
  const actionApi = getActionApi();
  if (!actionApi) {
    console.warn('No browser action API available for badge fallback.');
    return;
  }

  const fallbackMessage = typeof message === 'string' ? message : String(message);

  actionApi.setBadgeText({ text: BADGE_FALLBACK_TEXT });
  if (typeof actionApi.setBadgeBackgroundColor === 'function') {
    actionApi.setBadgeBackgroundColor({ color: BADGE_FALLBACK_COLOR });
  }
  if (typeof actionApi.setTitle === 'function') {
    actionApi.setTitle({ title: `${BADGE_FALLBACK_TITLE_PREFIX}${fallbackMessage}` });
  }

  scheduleBadgeClear(actionApi);
}

// Polyfill alert for MV3 service worker context by messaging the active tab content script,
// falling back to an action badge/title if no receiver is available.
if (typeof self.alert !== 'function') {
  self.alert = function (message) {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to query active tab for alert:', chrome.runtime.lastError);
        showBadgeFallback(message);
        return;
      }

      const tab = Array.isArray(tabs) ? tabs[0] : null;
      if (tab && typeof tab.id === 'number') {
        chrome.tabs.sendMessage(tab.id, { message }, () => {
          if (chrome.runtime.lastError) {
            console.warn('Falling back to action badge for alert:', chrome.runtime.lastError);
            showBadgeFallback(message);
          }
        });
        return;
      }

      showBadgeFallback(message);
    });
  };
}

// Load the shared background logic so MV3 reuses the MV2 implementation.
importScripts('./background.js');
