// Polyfill alert for MV3 service worker context by messaging the active tab content script.
if (typeof self.alert !== 'function') {
  self.alert = function (message) {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to query active tab for alert:', chrome.runtime.lastError);
        return;
      }

      const tab = Array.isArray(tabs) ? tabs[0] : null;
      if (tab && typeof tab.id === 'number') {
        chrome.tabs.sendMessage(tab.id, { message });
      }
    });
  };
}

// Load the shared background logic so MV3 reuses the MV2 implementation.
importScripts('./background.js');
