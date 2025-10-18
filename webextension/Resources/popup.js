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

    let statusState = 'idle';
    let resetStatusTimeoutId = null;
    let isProofreading = false;
    let selectionMonitorId = null;
    let lastSelectionHadContent = false;

    if (proofreadButton) {
        proofreadButton.disabled = true;
    }

    const setStatus = (message, isError = false) => {
        status.textContent = message;
        status.style.color = isError ? '#d93025' : 'green';
    };

    const clearProofreadStatus = () => {
        if (resetStatusTimeoutId) {
            clearTimeout(resetStatusTimeoutId);
            resetStatusTimeoutId = null;
        }
        if (proofreadStatus) {
            proofreadStatus.textContent = '';
            proofreadStatus.className = '';
        }
        statusState = 'idle';
    };

    const setProofreadStatus = (message, state = 'success') => {
        if (!proofreadStatus) {
            return;
        }

        if (resetStatusTimeoutId) {
            clearTimeout(resetStatusTimeoutId);
            resetStatusTimeoutId = null;
        }

        statusState = state;
        proofreadStatus.textContent = '';
        proofreadStatus.className = '';

        const statusClassMap = {
            success: 'status-success',
            error: 'status-error',
            loading: 'status-loading',
            hint: 'status-hint'
        };

        const className = statusClassMap[state];
        if (className) {
            proofreadStatus.classList.add(className);
        }

        if (!message) {
            if (state === 'idle') {
                clearProofreadStatus();
            }
            return;
        }

        if (state === 'loading') {
            const spinner = document.createElement('span');
            spinner.className = 'spinner';
            spinner.setAttribute('aria-hidden', 'true');
            proofreadStatus.appendChild(spinner);
            proofreadStatus.appendChild(document.createTextNode(message));
        } else {
            proofreadStatus.textContent = message;
        }

        if (state === 'success') {
            resetStatusTimeoutId = window.setTimeout(() => {
                if (statusState === 'success') {
                    clearProofreadStatus();
                }
            }, 2500);
        }
    };

    const setHintIfIdle = (message) => {
        if (statusState === 'idle' || statusState === 'hint') {
            setProofreadStatus(message, 'hint');
        }
    };

    const applyButtonAvailability = () => {
        if (!proofreadButton) {
            return;
        }

        if (isProofreading) {
            proofreadButton.disabled = true;
            return;
        }

        proofreadButton.disabled = !lastSelectionHadContent;
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

    const requestSelectionFromTab = (tabId, options = {}) => new Promise((resolve, reject) => {
        const { silent = false, notifyOnEmpty = false } = options;
        const message = { type: 'gptProofreadSelectionRequest' };
        if (notifyOnEmpty) {
            message.notifyOnEmpty = true;
        }

        chrome.tabs.sendMessage(tabId, message, (response) => {
            const error = chrome.runtime.lastError;
            if (error) {
                if (silent) {
                    resolve({ text: '', error: new Error('Unable to read the selected text on this page.') });
                    return;
                }
                reject(new Error('Unable to read the selected text on this page.'));
                return;
            }

            if (!response || typeof response.text !== 'string') {
                resolve({ text: '' });
                return;
            }

            resolve({ text: response.text });
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

    const updateSelectionState = async (options = {}) => {
        const { showHint = false } = options;

        if (!proofreadButton) {
            return;
        }

        try {
            const tab = await getActiveTab();
            const result = await requestSelectionFromTab(tab.id, { silent: true });
            lastSelectionHadContent = Boolean(result.text && result.text.trim());

            applyButtonAvailability();

            if (!lastSelectionHadContent && showHint) {
                if (result.error) {
                    setHintIfIdle(result.error.message);
                } else {
                    setHintIfIdle('Select text in the page to enable proofreading.');
                }
            } else if (lastSelectionHadContent && statusState === 'hint') {
                clearProofreadStatus();
            }
        } catch (error) {
            lastSelectionHadContent = false;
            applyButtonAvailability();
            if (showHint) {
                setProofreadStatus(error.message || 'Unable to locate an active tab.', 'error');
            }
        }
    };

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

    updateSelectionState({ showHint: true });
    selectionMonitorId = window.setInterval(() => {
        updateSelectionState();
    }, 1200);

    window.addEventListener('unload', () => {
        if (selectionMonitorId) {
            clearInterval(selectionMonitorId);
            selectionMonitorId = null;
        }
    });

    proofreadButton.addEventListener('click', async () => {
        if (isProofreading) {
            return;
        }

        isProofreading = true;
        applyButtonAvailability();
        setProofreadStatus('Proofreading selection…', 'loading');

        try {
            const tab = await getActiveTab();
            const { text: selection } = await requestSelectionFromTab(tab.id, { notifyOnEmpty: true });

            if (!selection || !selection.trim()) {
                throw new Error('Please select some text to proofread before trying again.');
            }

            await requestProofread(tab.id, selection);
            setProofreadStatus('Proofreading complete!', 'success');
        } catch (error) {
            setProofreadStatus(error.message || 'Failed to proofread the selected text.', 'error');
        } finally {
            isProofreading = false;
            await updateSelectionState({ showHint: true });
        }
    });
});
