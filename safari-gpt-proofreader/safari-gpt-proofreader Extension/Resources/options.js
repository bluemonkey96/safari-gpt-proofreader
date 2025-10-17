document.addEventListener('DOMContentLoaded', function() {
    const saveButton = document.getElementById('saveKey');
    const apiKeyInput = document.getElementById('apiKey');
    const status = document.getElementById('status');

    // Load the saved API key when the options page is loaded
    chrome.storage.local.get('openai_api_key', function(result) {
        if (result.openai_api_key) {
            apiKeyInput.value = result.openai_api_key;
        }
    });

    // Save the API key to local storage when the button is clicked
    saveButton.addEventListener('click', function() {
        const apiKey = apiKeyInput.value;
        if (apiKey) {
            chrome.storage.local.set({ openai_api_key: apiKey }, function() {
                status.textContent = 'API Key saved!';
                setTimeout(() => status.textContent = '', 3000); // Clear status after 3 seconds
            });
        } else {
            status.textContent = 'Please enter a valid API Key.';
        }
    });
});
