// Function to proofread selected text using OpenAI GPT-3.5 Turbo
function proofreadText(selectedText) {
    console.log("Sending text to GPT for proofreading...");

    // Get API key from storage
    chrome.storage.local.get(['openai_api_key', 'tone_preference'], function (result) {
        const apiKey = result.openai_api_key;
        const tonePreference = result.tone_preference || 'Neutral';
        const toneInstruction = tonePreference.toLowerCase();

        if (!apiKey) {
            console.error("No API Key found.");
            showErrorMessage("No API Key found. Please set your API Key in the extension settings.");
            return;
        }

        // Prepare the API request payload for GPT-3.5-turbo
        const systemPrompt = `You are a helpful assistant. Please proofread the following text and respond in a ${toneInstruction} tone.`;

        const payload = {
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: selectedText }
            ],
            max_tokens: 500
        };

        // Send the API request to OpenAI
        fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error("Error message captured: ", data.error.message);
                showErrorMessage(`OpenAI API Error: ${data.error.message}`);
            } else {
                // Get the completion (proofread text) from the API response
                const proofreadText = data.choices[0].message.content;
                console.log("Proofread text: ", proofreadText);

                // Replace the selected text with the proofread version
                replaceSelectedText(proofreadText);
            }
        })
        .catch(error => {
            console.error("Error in proofreadText function: ", error);
            showErrorMessage("Failed to proofread the text. Please try again.");
        });
    });
}

// Function to display error messages
function showErrorMessage(message) {
    alert(message);
}

// Function to replace the selected text with proofread text
function replaceSelectedText(newText) {
    chrome.tabs.executeScript({
        code: `document.activeElement.value = \`${newText}\`;`
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
        proofreadText(selectedText);
    }
});
