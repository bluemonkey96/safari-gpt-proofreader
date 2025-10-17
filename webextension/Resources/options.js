document.addEventListener('DOMContentLoaded', function() {
    const saveButton = document.getElementById('saveKey');
    const apiKeyInput = document.getElementById('apiKey');
    const toneSelect = document.getElementById('toneSelect');
    const status = document.getElementById('status');

    // Load the saved API key when the options page is loaded
    chrome.storage.local.get(['openai_api_key', 'tone_preference'], function(result) {
        if (result.openai_api_key) {
            apiKeyInput.value = result.openai_api_key;
        }

        if (result.tone_preference) {
            toneSelect.value = result.tone_preference;
        }
    });

    // Save the API key to local storage when the button is clicked
    saveButton.addEventListener('click', function() {
        const apiKey = apiKeyInput.value;
        const tonePreference = toneSelect.value;

        if (apiKey) {
            chrome.storage.local.set({ openai_api_key: apiKey, tone_preference: tonePreference }, function() {
                status.textContent = 'Settings saved!';
                setTimeout(() => status.textContent = '', 3000); // Clear status after 3 seconds
            });
        } else {
            status.textContent = 'Please enter a valid API Key.';
        }
    });
});
