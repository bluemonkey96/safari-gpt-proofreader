document.addEventListener('DOMContentLoaded', function () {
    const apiKeyInput = document.getElementById('apiKey');
    const saveButton = document.getElementById('saveKey');
    const status = document.getElementById('status');

    // Load the saved API key
    chrome.storage.local.get('openai_api_key', function (result) {
        if (result.openai_api_key) {
            apiKeyInput.value = result.openai_api_key;
        }
    });

    // Save the API key when the button is clicked
    saveButton.addEventListener('click', function () {
        const apiKey = apiKeyInput.value;
        if (apiKey) {
            chrome.storage.local.set({ openai_api_key: apiKey }, function () {
                status.textContent = 'API Key saved!';
                setTimeout(() => status.textContent = '', 3000);
            });
        } else {
            status.textContent = 'Please enter a valid API Key.';
        }
    });
});
