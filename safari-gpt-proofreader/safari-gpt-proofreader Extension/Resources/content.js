chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received in content script:", request.message);  // Log the message received from background
    if (request.message) {
        alert(request.message);  // Show the message passed from the background script
    }
});
