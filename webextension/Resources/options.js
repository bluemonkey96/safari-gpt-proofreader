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

document.addEventListener('DOMContentLoaded', function() {
    const saveButton = document.getElementById('saveKey');
    const apiKeyInput = document.getElementById('apiKey');
    const toneSelect = document.getElementById('toneSelect');
    const status = document.getElementById('status');

    const setStatus = (message, isError = false) => {
        status.textContent = message;
        status.style.color = isError ? '#d93025' : 'green';
    };

    // Load the saved API key when the options page is loaded
    safeStorageGet(['openai_api_key', 'tone_preference'], function(result) {
        if (result.openai_api_key) {
            apiKeyInput.value = result.openai_api_key;
        }

        if (result.tone_preference) {
            toneSelect.value = result.tone_preference;
        }
    }, () => {
        setStatus('Failed to load saved settings. Please try again.', true);
    });

    // Save the API key to local storage when the button is clicked
    saveButton.addEventListener('click', function() {
        const apiKey = apiKeyInput.value.trim();
        const tonePreference = toneSelect.value;

        if (apiKey) {
            safeStorageSet({ openai_api_key: apiKey, tone_preference: tonePreference }, function() {
                setStatus('Settings saved!', false);
                setTimeout(() => {
                    status.textContent = '';
                }, 3000); // Clear status after 3 seconds
            }, () => {
                setStatus('Failed to save settings. Please try again.', true);
            });
        } else {
            setStatus('Please enter a valid API Key.', true);
        }
    });
});
