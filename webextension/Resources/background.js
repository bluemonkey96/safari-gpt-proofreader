const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 15000;
const BADGE_ERROR_TEXT = '!';
const BADGE_ERROR_COLOR = '#d93025';

function getBadgeApi() {
    return (chrome.action && typeof chrome.action.setBadgeText === 'function')
        ? chrome.action
        : chrome.browserAction;
}

function setBadge(text, color) {
    const badgeApi = getBadgeApi();
    if (!badgeApi || typeof badgeApi.setBadgeText !== 'function') {
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

// Function to proofread selected text using OpenAI GPT-3.5 Turbo
function proofreadText(selectedText, tabId, options = {}) {
    console.log("Sending text to GPT for proofreading...");

    const { notifyErrors = true } = options;

    return new Promise((resolve, reject) => {
        safeStorageGet(['openai_api_key', 'tone_preference'], function (result) {
            const apiKey = result.openai_api_key;
            const tonePreference = result.tone_preference || 'Neutral';
            const toneInstruction = tonePreference.toLowerCase();

            if (!apiKey) {
                console.error("No API Key found.");
                const error = new Error("No API Key found. Please set your API Key in the extension settings.");
                if (notifyErrors) {
                    showErrorMessage(error.message);
                }
                reject(error);
                return;
            }

            attemptProofread(selectedText, apiKey, toneInstruction)
                .then(proofreadVersion => {
                    if (!proofreadVersion) {
                        const error = new Error('Failed to proofread the text. Please try again.');
                        if (notifyErrors) {
                            showErrorMessage(error.message);
                        }
                        reject(error);
                        return;
                    }

                    replaceSelectedText(tabId, selectedText, proofreadVersion);
                    resolve(proofreadVersion);
                })
                .catch(error => {
                    console.error("Error in proofreadText function: ", error);
                    const message = error && error.message ? error.message : "Failed to proofread the text. Please try again.";
                    if (notifyErrors) {
                        showErrorMessage(message);
                    }
                    reject(error instanceof Error ? error : new Error(message));
                });
        }, () => {
            const error = new Error('Failed to read your extension settings. Please try again.');
            if (notifyErrors) {
                showErrorMessage(error.message);
            }
            reject(error);
        });
    });
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
        console.log("Proofread text: ", proofreadText);
        return proofreadText;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error("The proofreading request timed out. Please try again.");
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

// Function to display error messages
function showErrorMessage(message) {
    alert(message);
}

// Function to replace the selected text with proofread text
function replaceSelectedText(tabId, originalText, newText) {
    if (typeof tabId !== 'number') {
        console.warn('No valid tabId provided for text replacement.');
        return;
    }

    chrome.tabs.sendMessage(tabId, {
        type: 'gptProofreadResult',
        proofreadText: newText,
        originalText
    }, undefined, () => {
        const error = chrome.runtime.lastError;
        if (error) {
            console.warn('Failed to send proofread result to content script:', error.message);
        }
    });
}

// Add context menu item for proofreading
chrome.runtime.onInstalled.addListener(function () {
    chrome.contextMenus.create({
        id: "proofreadGPT",
        title: "Proofread with GPT",
        contexts: ["selection"]
    });
});

// Listener for context menu clicks
chrome.contextMenus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId === "proofreadGPT") {
        const selectedText = info.selectionText;
        console.log("Context menu clicked. Selected text: ", selectedText);
        proofreadText(selectedText, tab.id);
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

        proofreadText(selectedText, tabId, { notifyErrors: false })
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
});
