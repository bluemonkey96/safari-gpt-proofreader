const BADGE_FALLBACK_TEXT = 'ERR';
const BADGE_FALLBACK_COLOR = '#d93025';
const BADGE_FALLBACK_TIMEOUT_MS = 8000;
const BADGE_FALLBACK_TITLE_PREFIX = 'GPT Proofreader – ';
const DEFAULT_ACTION_TITLE = 'GPT Proofreader';
const BADGE_FALLBACK_TITLE = 'No content script on this page';

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

function showBadgeFallback(message = BADGE_FALLBACK_TITLE) {
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

  if (typeof recordLastError === 'function') {
    recordLastError(fallbackMessage);
  }
}

// Load the shared background logic so MV3 reuses the MV2 implementation.
importScripts('./background.js');

// Polyfill alert for MV3 service worker context by messaging the active tab content script,
// falling back to an action badge/title if no receiver is available.
if (typeof self.alert !== 'function') {
  self.alert = async function (message) {
    const fallbackMessage = message || BADGE_FALLBACK_TITLE;

    if (typeof getActiveTabSafe === 'function' && typeof sendToTabSafe === 'function') {
      try {
        const tab = await getActiveTabSafe();
        if (tab && typeof tab.id === 'number') {
          const result = await sendToTabSafe(tab.id, { message: String(message) }, { fallbackTitle: BADGE_FALLBACK_TITLE });
          if (result.ok) {
            return;
          }
        }
      } catch (error) {
        console.warn('Alert polyfill failed to reach active tab:', error);
      }
    }

    showBadgeFallback(fallbackMessage);
  };
}
