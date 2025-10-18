function notifyBadge(state) {
    if (!state) {
        return;
    }

    try {
        chrome.runtime.sendMessage({ type: 'storageBadge', state }, () => {
            const error = chrome.runtime.lastError;
            if (error && !/Receiving end/.test(error.message)) {
                console.warn('Failed to notify badge state:', error);
            }
        });
    } catch (error) {
        console.warn('Unable to notify badge state:', error);
    }
}

function safeStorageGet(keys, onSuccess, onError) {
    chrome.storage.local.get(keys, (result) => {
        const error = chrome.runtime.lastError;
        if (error) {
            console.error('Failed to read extension storage:', error);
            notifyBadge('error');
            if (typeof onError === 'function') {
                onError(error);
            }
            return;
        }

        notifyBadge('clear');
        onSuccess(result);
    });
}

function safeStorageSet(values, onSuccess, onError) {
    chrome.storage.local.set(values, () => {
        const error = chrome.runtime.lastError;
        if (error) {
            console.error('Failed to write extension storage:', error);
            notifyBadge('error');
            if (typeof onError === 'function') {
                onError(error);
            }
            return;
        }

        notifyBadge('clear');
        if (typeof onSuccess === 'function') {
            onSuccess();
        }
    });
}

document.addEventListener('DOMContentLoaded', function () {
    const apiKeyInput = document.getElementById('apiKey');
    const saveButton = document.getElementById('saveKey');
    const status = document.getElementById('status');
    const proofreadButton = document.getElementById('proofreadSelection');
    const proofreadStatus = document.getElementById('proofreadStatus');

    const setStatus = (message, isError = false) => {
        status.textContent = message;
        status.style.color = isError ? '#d93025' : 'green';
    };

    const setProofreadStatus = (message, state = 'success') => {
        proofreadStatus.textContent = message;
        if (state === 'error') {
            proofreadStatus.style.color = '#d93025';
        } else if (state === 'loading') {
            proofreadStatus.style.color = '#202124';
        } else {
            proofreadStatus.style.color = 'green';
        }
    };

    const clearProofreadStatus = () => {
        proofreadStatus.textContent = '';
    };

    const getActiveTab = () => new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const error = chrome.runtime.lastError;
            if (error) {
                reject(new Error('Unable to locate the active tab.'));
                return;
            }

            const tab = Array.isArray(tabs) ? tabs[0] : null;
            if (!tab || typeof tab.id !== 'number') {
                reject(new Error('No active tab available.'));
                return;
            }

            resolve(tab);
        });
    });

    const requestSelectionFromTab = (tabId) => new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, { type: 'gptProofreadSelectionRequest' }, (response) => {
            const error = chrome.runtime.lastError;
            if (error) {
                reject(new Error('Unable to read the selected text on this page.')); 
                return;
            }

            if (!response || typeof response.text !== 'string') {
                resolve('');
                return;
            }

            resolve(response.text);
        });
    });

    const requestProofread = (tabId, selectedText) => new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'proofreadSelection', tabId, selectedText }, (response) => {
            const error = chrome.runtime.lastError;
            if (error) {
                reject(new Error('Failed to start proofreading. Please try again.'));
                return;
            }

            if (!response) {
                reject(new Error('No response received from the extension.'));
                return;
            }

            if (response.ok) {
                resolve();
                return;
            }

            const message = typeof response.error === 'string' && response.error.trim()
                ? response.error
                : 'Failed to proofread the selected text.';
            reject(new Error(message));
        });
    });

    safeStorageGet(['openai_api_key'], (result) => {
        if (result.openai_api_key) {
            apiKeyInput.value = result.openai_api_key;
        }
    }, () => {
        setStatus('Failed to load saved settings. Please try again.', true);
    });

    // Save the API key when the button is clicked
    saveButton.addEventListener('click', function () {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            safeStorageSet({ openai_api_key: apiKey }, () => {
                setStatus('API Key saved!', false);
                setTimeout(() => {
                    status.textContent = '';
                }, 3000);
            }, () => {
                setStatus('Failed to save API Key. Please try again.', true);
            });
        } else {
            setStatus('Please enter a valid API Key.', true);
        }
    });

    proofreadButton.addEventListener('click', async () => {
        proofreadButton.disabled = true;
        setProofreadStatus('Proofreading selection…', 'loading');

        try {
            const tab = await getActiveTab();
            const selection = await requestSelectionFromTab(tab.id);

            if (!selection || !selection.trim()) {
                throw new Error('Please select some text to proofread before trying again.');
            }

            await requestProofread(tab.id, selection);
            setProofreadStatus('Proofreading complete!');
            setTimeout(() => {
                if (proofreadStatus.textContent === 'Proofreading complete!') {
                    clearProofreadStatus();
                }
            }, 2500);
        } catch (error) {
            setProofreadStatus(error.message || 'Failed to proofread the selected text.', 'error');
        } finally {
            proofreadButton.disabled = false;
        }
    });
});
