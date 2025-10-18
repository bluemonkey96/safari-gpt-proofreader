const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 15000;
const BADGE_ERROR_TEXT = '!';
const BADGE_ERROR_COLOR = '#d93025';
const FALLBACK_BADGE_TEXT = 'ERR';
const FALLBACK_BADGE_COLOR = '#d93025';
const FALLBACK_BADGE_TITLE = 'No content script on this page';
const FALLBACK_BADGE_TIMEOUT_MS = 8000;
const DEFAULT_ACTION_TITLE = 'GPT Proofreader';

let debugEnabled = false;
let badgeFallbackTimeoutId;

function debugLog(event, payload = {}) {
    if (debugEnabled) {
        try {
            console.debug('[proofreader]', event, payload);
        } catch (error) {
            // Ignore logging failures.
        }
    }
}

function getBadgeApi() {
    return (chrome.action && typeof chrome.action.setBadgeText === 'function')
        ? chrome.action
        : chrome.browserAction;
}

function setActionTitle(title) {
    const badgeApi = getBadgeApi();
    if (badgeApi && typeof badgeApi.setTitle === 'function') {
        try {
            badgeApi.setTitle({ title });
        } catch (error) {
            debugLog('action.setTitle:error', { message: error.message });
        }
    }
}

function setBadge(text, color) {
    const badgeApi = getBadgeApi();
    if (!badgeApi || typeof badgeApi.setBadgeText !== 'function') {
        debugLog('badge:missingApi');
        return;
    }

    try {
        badgeApi.setBadgeText({ text });
        if (color && typeof badgeApi.setBadgeBackgroundColor === 'function') {
            badgeApi.setBadgeBackgroundColor({ color });
        }
    } catch (error) {
        debugLog('badge:set:error', { message: error.message });
    }
}

function scheduleBadgeFallbackClear() {
    const badgeApi = getBadgeApi();
    if (!badgeApi) {
        return;
    }

    if (badgeFallbackTimeoutId) {
        clearTimeout(badgeFallbackTimeoutId);
    }

    badgeFallbackTimeoutId = setTimeout(() => {
        try {
            badgeApi.setBadgeText({ text: '' });
            if (typeof badgeApi.setTitle === 'function') {
                badgeApi.setTitle({ title: DEFAULT_ACTION_TITLE });
            }
        } catch (error) {
            debugLog('badge:clear:error', { message: error.message });
        }
    }, FALLBACK_BADGE_TIMEOUT_MS);
}

function showNoContentScriptFallback(message = FALLBACK_BADGE_TITLE) {
    setBadge(FALLBACK_BADGE_TEXT, FALLBACK_BADGE_COLOR);
    setActionTitle(`${DEFAULT_ACTION_TITLE} – ${message}`);
    scheduleBadgeFallbackClear();
    recordLastError(message);
}

function clearActionBadgeFallback() {
    const badgeApi = getBadgeApi();
    if (!badgeApi) {
        return;
    }

    try {
        badgeApi.setBadgeText({ text: '' });
        if (typeof badgeApi.setTitle === 'function') {
            badgeApi.setTitle({ title: DEFAULT_ACTION_TITLE });
        }
    } catch (error) {
        debugLog('badge:clearImmediate:error', { message: error.message });
    }
}

function setStorageErrorBadge() {
    setBadge(BADGE_ERROR_TEXT, BADGE_ERROR_COLOR);
    setActionTitle(`${DEFAULT_ACTION_TITLE} – Storage issue`);
}

function clearStorageErrorBadge() {
    setBadge('');
    setActionTitle(DEFAULT_ACTION_TITLE);
}

function recordLastError(message) {
    const payload = { last_error_message: message, last_error_at: Date.now() };
    try {
        chrome.storage.local.set(payload, () => {
            const error = chrome.runtime.lastError;
            if (error) {
                debugLog('storage:setLastError:error', { message: error.message });
            }
        });
    } catch (error) {
        debugLog('storage:setLastError:exception', { message: error.message });
    }
}

function safeStorageGet(keys, onSuccess, onError) {
    try {
        chrome.storage.local.get(keys, (result) => {
            const error = chrome.runtime.lastError;
            if (error) {
                console.error('Failed to access extension storage:', error);
                setStorageErrorBadge();
                recordLastError(error.message || 'Storage read failed');
                if (typeof onError === 'function') {
                    onError(error);
                }
                return;
            }

            clearStorageErrorBadge();
            onSuccess(result);
        });
    } catch (error) {
        console.error('Unexpected storage access failure:', error);
        setStorageErrorBadge();
        recordLastError(error.message || 'Storage exception');
        if (typeof onError === 'function') {
            onError(error);
        }
    }
}

function safeStorageSet(values, onSuccess, onError) {
    try {
        chrome.storage.local.set(values, () => {
            const error = chrome.runtime.lastError;
            if (error) {
                console.error('Failed to persist extension storage:', error);
                setStorageErrorBadge();
                recordLastError(error.message || 'Storage write failed');
                if (typeof onError === 'function') {
                    onError(error);
                }
                return;
            }

            clearStorageErrorBadge();
            if (typeof onSuccess === 'function') {
                onSuccess();
            }
        });
    } catch (error) {
        console.error('Unexpected storage write failure:', error);
        setStorageErrorBadge();
        recordLastError(error.message || 'Storage exception');
        if (typeof onError === 'function') {
            onError(error);
        }
    }
}

function readDebugFlag() {
    safeStorageGet(['debug_enabled'], (result) => {
        debugEnabled = Boolean(result && result.debug_enabled);
        debugLog('debug:flag:init', { enabled: debugEnabled });
    });
}

function handleStorageChanges(changes, areaName) {
    if (areaName !== 'local' || !changes) {
        return;
    }

    if (Object.prototype.hasOwnProperty.call(changes, 'debug_enabled')) {
        debugEnabled = Boolean(changes.debug_enabled.newValue);
        debugLog('debug:flag:update', { enabled: debugEnabled });
    }
}

readDebugFlag();
if (chrome.storage && typeof chrome.storage.onChanged?.addListener === 'function') {
    chrome.storage.onChanged.addListener(handleStorageChanges);
}

function getActiveTabSafe() {
    return new Promise((resolve) => {
        try {
            chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
                const error = chrome.runtime.lastError;
                if (error) {
                    debugLog('tabs.query:error', { message: error.message });
                    resolve(null);
                    return;
                }

                if (Array.isArray(tabs) && tabs.length > 0) {
                    resolve(tabs[0]);
                } else {
                    resolve(null);
                }
            });
        } catch (error) {
            debugLog('tabs.query:exception', { message: error.message });
            resolve(null);
        }
    });
}

function isNoReceiverError(message) {
    if (typeof message !== 'string') {
        return false;
    }
    return message.includes('Receiving end does not exist') ||
        message.includes('Could not establish connection') ||
        message.includes('No tab with id');
}

function sendToTabSafe(tabId, payload, options = {}) {
    const fallbackTitle = typeof options.fallbackTitle === 'string' ? options.fallbackTitle : FALLBACK_BADGE_TITLE;

    return new Promise((resolve) => {
        if (typeof tabId !== 'number') {
            debugLog('sendToTabSafe:invalidTab', { tabId });
            showNoContentScriptFallback(fallbackTitle);
            resolve({ ok: false, reason: 'invalid-tab' });
            return;
        }

        try {
            chrome.tabs.sendMessage(tabId, payload, undefined, (response) => {
                const error = chrome.runtime.lastError;
                if (error) {
                    const message = error.message || 'Failed to deliver message';
                    debugLog('tabs.sendMessage:error', { tabId, message });
                    if (isNoReceiverError(message)) {
                        showNoContentScriptFallback(fallbackTitle);
                    }
                    recordLastError(message);
                    resolve({ ok: false, reason: 'send-error', error: message, response });
                    return;
                }

                clearActionBadgeFallback();
                resolve({ ok: true, response });
            });
        } catch (error) {
            debugLog('tabs.sendMessage:exception', { tabId, message: error.message });
            showNoContentScriptFallback(fallbackTitle);
            recordLastError(error.message || 'sendMessage exception');
            resolve({ ok: false, reason: 'exception', error: error.message });
        }
    });
}

// Function to proofread selected text using OpenAI GPT-3.5 Turbo
async function proofreadText(selectedText, tabId, options = {}) {
    debugLog('proofread:start', { tabId, source: options.source || 'unknown' });

    const { notifyErrors = true } = options;

    try {
        const result = await new Promise((resolve, reject) => {
            safeStorageGet(['openai_api_key', 'tone_preference'], resolve, reject);
        });

        const apiKey = result.openai_api_key;
        const tonePreference = result.tone_preference || 'Neutral';
        const toneInstruction = tonePreference.toLowerCase();

        if (!apiKey) {
            const error = new Error("No API Key found. Please set your API Key in the extension settings.");
            if (notifyErrors) {
                await awaitShowErrorMessage(error.message, tabId);
            }
            recordLastError(error.message);
            throw error;
        }

        const proofreadVersion = await attemptProofread(selectedText, apiKey, toneInstruction);
        if (!proofreadVersion) {
            const error = new Error('Failed to proofread the text. Please try again.');
            if (notifyErrors) {
                await awaitShowErrorMessage(error.message, tabId);
            }
            recordLastError(error.message);
            throw error;
        }

        const replacementResult = await replaceSelectedText(tabId, selectedText, proofreadVersion);
        if (!replacementResult.ok) {
            const errorMessage = replacementResult.message || 'Unable to update the selected text.';
            if (notifyErrors) {
                await awaitShowErrorMessage(errorMessage, tabId);
            }
            recordLastError(errorMessage);
            throw new Error(errorMessage);
        }

        debugLog('proofread:ok', { tabId });
        return proofreadVersion;
    } catch (error) {
        const message = error && error.message ? error.message : 'Failed to proofread the text. Please try again.';
        debugLog('proofread:error', { tabId, message });
        if (notifyErrors) {
            await awaitShowErrorMessage(message, tabId);
        }
        throw error instanceof Error ? error : new Error(message);
    }
}

async function attemptProofread(selectedText, apiKey, toneInstruction, attempt = 0) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const payload = {
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `You are a helpful assistant. Please proofread the following text and respond in a ${toneInstruction} tone.`
                },
                { role: "user", content: selectedText }
            ],
            max_tokens: 500
        };

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            let errorMessage = `Request failed with status ${response.status}`;
            try {
                const errorBody = await response.json();
                if (errorBody && errorBody.error && errorBody.error.message) {
                    errorMessage = `OpenAI API Error: ${errorBody.error.message}`;
                }
            } catch (parseError) {
                // Ignore JSON parse errors and use default message
            }

            if (response.status === 429 && attempt < MAX_RETRIES) {
                const backoffTime = RETRY_DELAY_MS * (attempt + 1);
                console.warn(`Received 429 from OpenAI. Retrying in ${backoffTime}ms (attempt ${attempt + 1}).`);
                await new Promise(resolve => setTimeout(resolve, backoffTime));
                return attemptProofread(selectedText, apiKey, toneInstruction, attempt + 1);
            }

            throw new Error(errorMessage);
        }

        const data = await response.json();
        if (!data || !data.choices || !data.choices.length || !data.choices[0].message) {
            throw new Error("OpenAI response did not contain any completions.");
        }

        const proofreadText = data.choices[0].message.content;
        debugLog('proofread:response', { attempt, tabTextLength: selectedText.length });
        return proofreadText;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error("The proofreading request timed out. Please try again.");
        }
        debugLog('proofread:fetchError', { attempt, message: error.message });
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

// Function to display error messages
function showErrorMessage(message) {
    alert(message);
}

async function awaitShowErrorMessage(message, preferredTabId) {
    debugLog('toast:fallback', { message, preferredTabId });

    if (typeof preferredTabId === 'number') {
        const response = await sendToTabSafe(preferredTabId, { message });
        if (response.ok) {
            return;
        }
    }

    const activeTab = await getActiveTabSafe();
    if (activeTab && typeof activeTab.id === 'number') {
        const response = await sendToTabSafe(activeTab.id, { message });
        if (response.ok) {
            return;
        }
    }

    showNoContentScriptFallback();
}

// Function to replace the selected text with proofread text
async function replaceSelectedText(tabId, originalText, newText) {
    if (typeof tabId !== 'number') {
        debugLog('replaceSelectedText:invalidTab', { tabId });
        return { ok: false, message: 'Unable to locate the original tab.' };
    }

    const response = await sendToTabSafe(tabId, {
        type: 'gptProofreadResult',
        proofreadText: newText,
        originalText
    });

    if (!response.ok) {
        return { ok: false, message: 'Unable to deliver proofread text to the page.' };
    }

    return { ok: true };
}

// Add context menu item for proofreading
chrome.runtime.onInstalled.addListener(function () {
    try {
        chrome.contextMenus.create({
            id: "proofreadGPT",
            title: "Proofread with GPT",
            contexts: ["selection"]
        }, () => {
            const error = chrome.runtime.lastError;
            if (error) {
                debugLog('contextMenus.create:error', { message: error.message });
            }
        });
    } catch (error) {
        debugLog('contextMenus.create:exception', { message: error.message });
    }
});

// Listener for context menu clicks
chrome.contextMenus.onClicked.addListener(async function (info, tab) {
    if (info.menuItemId !== "proofreadGPT") {
        return;
    }

    const selectedText = typeof info.selectionText === 'string' ? info.selectionText : '';
    const tabId = tab && typeof tab.id === 'number' ? tab.id : undefined;

    if (!selectedText.trim()) {
        await awaitShowErrorMessage('Please select some text to proofread.', tabId);
        return;
    }

    debugLog('contextMenu:invoke', { tabId });

    try {
        await proofreadText(selectedText, tabId, { notifyErrors: false, source: 'context-menu' });
    } catch (error) {
        const message = error && error.message ? error.message : 'Failed to proofread the text. Please try again.';
        console.error('Context menu proofreading failed:', error);
        await awaitShowErrorMessage(message, tabId);
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request) {
        return;
    }

    if (request.type === 'storageBadge') {
        if (request.state === 'error') {
            setStorageErrorBadge();
        } else if (request.state === 'clear') {
            clearStorageErrorBadge();
        }
        return;
    }

    if (request.type === 'proofreadSelection') {
        const tabId = typeof request.tabId === 'number' ? request.tabId : (sender && sender.tab && typeof sender.tab.id === 'number' ? sender.tab.id : undefined);
        if (typeof tabId !== 'number') {
            sendResponse({ ok: false, error: 'Unable to identify the active tab.' });
            return;
        }

        const selectedText = typeof request.selectedText === 'string' ? request.selectedText : '';
        if (!selectedText.trim()) {
            sendResponse({ ok: false, error: 'Please select some text to proofread.' });
            return;
        }

        proofreadText(selectedText, tabId, { notifyErrors: false, source: 'popup' })
            .then(() => {
                if (typeof sendResponse === 'function') {
                    sendResponse({ ok: true });
                }
            })
            .catch(error => {
                if (typeof sendResponse === 'function') {
                    const message = error && error.message ? error.message : 'Failed to proofread the text. Please try again.';
                    sendResponse({ ok: false, error: message });
                }
            });

        return true;
    }

    if (request.type === 'gptProofreaderPing') {
        if (typeof sendResponse === 'function') {
            sendResponse({ ok: true });
        }
        return;
    }

    if (request.type === 'debugSelfTest') {
        if (typeof sendResponse === 'function') {
            sendResponse({ ok: true, timestamp: Date.now() });
        }
        return;
    }
});
