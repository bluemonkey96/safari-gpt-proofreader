(function() {
    const apiKeyDisplay = document.getElementById('apiKeyDisplay');
    const toneDisplay = document.getElementById('toneDisplay');
    const debugFlagDisplay = document.getElementById('debugFlagDisplay');
    const lastErrorDisplay = document.getElementById('lastErrorDisplay');
    const refreshButton = document.getElementById('refreshStorage');
    const pingButton = document.getElementById('pingButton');
    const pingStatus = document.getElementById('pingStatus');
    const selfTestInput = document.getElementById('selfTestInput');
    const selfTestButton = document.getElementById('selfTestButton');
    const selfTestStatus = document.getElementById('selfTestStatus');

    function maskKey(key) {
        if (!key) {
            return '(none)';
        }
        if (key.length <= 8) {
            return '••••';
        }
        const prefix = key.slice(0, 4);
        const suffix = key.slice(-4);
        return `${prefix}…${suffix}`;
    }

    function formatTimestamp(timestamp) {
        if (!timestamp) {
            return 'No errors recorded';
        }
        try {
            const date = new Date(timestamp);
            if (Number.isNaN(date.getTime())) {
                return 'No errors recorded';
            }
            return `${date.toLocaleString()} — see console for details.`;
        } catch (error) {
            return 'No errors recorded';
        }
    }

    function setStatus(element, message, type) {
        if (!element) {
            return;
        }
        element.textContent = message;
        element.classList.remove('ok', 'err', 'pending');
        if (type) {
            element.classList.add(type);
        }
    }

    function loadStorageSnapshot() {
        setStatus(apiKeyDisplay, 'Loading…');
        setStatus(toneDisplay, 'Loading…');
        setStatus(debugFlagDisplay, 'Loading…');
        setStatus(lastErrorDisplay, 'Loading…');

        try {
            chrome.storage.local.get(['openai_api_key', 'tone_preference', 'debug_enabled', 'last_error_message', 'last_error_at'], (result) => {
                const error = chrome.runtime.lastError;
                if (error) {
                    setStatus(apiKeyDisplay, 'Error loading storage', 'err');
                    setStatus(toneDisplay, error.message || 'Storage error', 'err');
                    setStatus(debugFlagDisplay, '—', 'err');
                    setStatus(lastErrorDisplay, '—', 'err');
                    return;
                }

                setStatus(apiKeyDisplay, maskKey(result.openai_api_key), '');
                setStatus(toneDisplay, result.tone_preference || 'Neutral', '');
                setStatus(debugFlagDisplay, result.debug_enabled ? 'Enabled' : 'Disabled', result.debug_enabled ? 'ok' : '');
                const lastError = result.last_error_message ? `${result.last_error_message} (${formatTimestamp(result.last_error_at)})` : 'No errors recorded';
                setStatus(lastErrorDisplay, lastError, result.last_error_message ? 'err' : '');
            });
        } catch (error) {
            setStatus(apiKeyDisplay, 'Exception while reading storage', 'err');
            setStatus(toneDisplay, error.message || 'Unknown error', 'err');
        }
    }

    function getActiveTab(callback) {
        try {
            chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
                const error = chrome.runtime.lastError;
                if (error) {
                    callback(null, error.message || 'Unable to query tabs');
                    return;
                }
                if (Array.isArray(tabs) && tabs.length) {
                    callback(tabs[0]);
                } else {
                    callback(null, 'No active tab detected');
                }
            });
        } catch (error) {
            callback(null, error.message || 'Tabs query failed');
        }
    }

    function pingContentScript() {
        setStatus(pingStatus, 'Checking…', 'pending');
        getActiveTab((tab, error) => {
            if (!tab) {
                setStatus(pingStatus, error || 'No active tab detected', 'err');
                return;
            }

            try {
                chrome.tabs.sendMessage(tab.id, { type: 'gptProofreaderPing' }, (response) => {
                    const lastError = chrome.runtime.lastError;
                    if (lastError) {
                        setStatus(pingStatus, lastError.message || 'No response from content script', 'err');
                        return;
                    }
                    if (response && response.ok) {
                        setStatus(pingStatus, 'Content script responded ✓', 'ok');
                    } else {
                        setStatus(pingStatus, 'No response from content script', 'err');
                    }
                });
            } catch (sendError) {
                setStatus(pingStatus, sendError.message || 'Failed to contact content script', 'err');
            }
        });
    }

    function replaceSelectionInTextarea(textarea, replacementText, originalText) {
        if (!textarea || typeof textarea.selectionStart !== 'number' || typeof textarea.selectionEnd !== 'number') {
            return false;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        if (end <= start) {
            return false;
        }

        const selected = textarea.value.slice(start, end);
        if (selected !== originalText) {
            return false;
        }

        textarea.setRangeText(replacementText);
        textarea.setSelectionRange(start, start + replacementText.length);
        return true;
    }

    function runLocalReplacementCheck() {
        const sample = selfTestInput.value;
        const misspelt = 'borwn';
        const corrected = 'brown';
        const startIndex = sample.indexOf(misspelt);

        if (startIndex === -1) {
            setStatus(selfTestStatus, 'Sample text missing the expected token.', 'err');
            return false;
        }

        selfTestInput.focus();
        selfTestInput.setSelectionRange(startIndex, startIndex + misspelt.length);
        const replaced = replaceSelectionInTextarea(selfTestInput, corrected, misspelt);

        if (!replaced) {
            setStatus(selfTestStatus, 'Self-test failed: selection could not be replaced.', 'err');
            selfTestInput.value = sample;
            return false;
        }

        const passed = selfTestInput.value.includes(corrected);
        selfTestInput.value = sample;

        if (!passed) {
            setStatus(selfTestStatus, 'Self-test inconclusive. Please try again.', 'pending');
            return false;
        }

        return true;
    }

    function runSelfTest() {
        if (!selfTestInput) {
            return;
        }

        setStatus(selfTestStatus, 'Running self-test…', 'pending');

        if (!runLocalReplacementCheck()) {
            return;
        }

        setStatus(selfTestStatus, 'Checking background response…', 'pending');

        try {
            chrome.runtime.sendMessage({ type: 'debugSelfTest' }, (response) => {
                const lastError = chrome.runtime.lastError;
                if (lastError) {
                    setStatus(selfTestStatus, `Background unavailable: ${lastError.message}`, 'err');
                    return;
                }

                if (response && response.ok) {
                    setStatus(selfTestStatus, 'Self-test passed: background responded ✓', 'ok');
                } else if (response && response.error) {
                    setStatus(selfTestStatus, response.error, 'err');
                } else {
                    setStatus(selfTestStatus, 'Self-test failed: no background response.', 'err');
                }
            });
        } catch (error) {
            setStatus(selfTestStatus, error.message || 'Self-test failed unexpectedly.', 'err');
        }
    }

    refreshButton?.addEventListener('click', loadStorageSnapshot);
    pingButton?.addEventListener('click', pingContentScript);
    selfTestButton?.addEventListener('click', runSelfTest);

    loadStorageSnapshot();
})();
