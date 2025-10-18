chrome.runtime.onInstalled.addListener(function() {
    chrome.contextMenus.create({
        id: "proofreadGPT",
        title: "Proofread with GPT",
        contexts: ["selection"]
    });
});

console.log("Background script loaded. Creating context menu...");

chrome.contextMenus.onClicked.addListener((info, tab) => {
    console.log("Context menu clicked. Selected text: ", info.selectionText);

    if (info.menuItemId === "proofreadGPT") {
        let selectedText = info.selectionText;

        // Retrieve the API key from local storage
        chrome.storage.local.get('openai_api_key', (result) => {
            if (result.openai_api_key) {
                proofreadText(selectedText, result.openai_api_key).then(proofreadVersion => {
                    if (proofreadVersion) {
                        // Replace the selected text with the proofread version
                        replaceSelectedText(tab.id, selectedText, proofreadVersion);
                    } else {
                        // Handle cases where proofreading fails
                        chrome.tabs.sendMessage(tab.id, { message: 'Proofread failed without a specific error.' });
                    }
                }).catch(error => {
                    console.log('Error detected:', error.message);
                    // Send detailed error message to content script
                    chrome.tabs.sendMessage(tab.id, { message: `OpenAI API Error: ${error.message}` });
                });
            } else {
                // No API key found, inform the user
                console.log('No API key found, sending to content script');
                chrome.tabs.sendMessage(tab.id, { message: 'No API key found. Please enter your OpenAI API key in the popup.' });
            }
        });
    }
});

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

// Function to send text to GPT for proofreading
async function proofreadText(selectedText, apiKey) {
    console.log("Sending text to GPT for proofreading...");

    try {
        const response = await fetch('https://api.openai.com/v1/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                prompt: `Proofread this text: ${selectedText}`,
                max_tokens: 200
            })
        });

        const responseBody = await response.text();
        console.log("Full API response:", responseBody);

        if (!response.ok) {
            const parsedError = JSON.parse(responseBody);
            const errorMessage = parsedError.error?.message || "Unknown error occurred";
            console.log('Error message captured:', errorMessage);
            throw new Error(errorMessage);  // This will send the actual detailed error to the catch block
        }

        const data = JSON.parse(responseBody);
        console.log("Received proofread text from GPT:", data.choices[0].text.trim());
        return data.choices[0].text.trim();
    } catch (error) {
        console.error('Error in proofreadText function:', error.message);
        throw error;  // Re-throwing the error to ensure it gets handled by the catch block
    }
}
