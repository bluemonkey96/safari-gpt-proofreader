const TOAST_CONTAINER_ID = "gpt-proofreader-toast-container";
const TOAST_LIFETIME_MS = 4000;

function ensureToastContainer() {
    let container = document.getElementById(TOAST_CONTAINER_ID);
    if (!container) {
        container = document.createElement("div");
        container.id = TOAST_CONTAINER_ID;
        Object.assign(container.style, {
            position: "fixed",
            top: "16px",
            right: "16px",
            zIndex: "2147483647",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            maxWidth: "320px",
            pointerEvents: "none",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        });
        document.body.appendChild(container);
    }
    return container;
}

function showToast(message) {
    if (!document || !document.body) {
        window.alert(message);
        return;
    }

    const container = ensureToastContainer();
    const toast = document.createElement("div");
    Object.assign(toast.style, {
        background: "rgba(0, 0, 0, 0.85)",
        color: "#fff",
        padding: "12px 16px",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
        fontSize: "14px",
        lineHeight: "1.4",
        pointerEvents: "auto",
        transition: "opacity 150ms ease",
        opacity: "1"
    });
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = "1";
    });

    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => {
            if (toast.parentElement === container) {
                container.removeChild(toast);
            }
            if (!container.children.length) {
                container.remove();
            }
        }, 200);
    }, TOAST_LIFETIME_MS);
}

function getActiveElementSelection() {
    const activeElement = document.activeElement;

    if (activeElement && typeof activeElement.value === 'string' && typeof activeElement.selectionStart === 'number' && typeof activeElement.selectionEnd === 'number') {
        const start = activeElement.selectionStart;
        const end = activeElement.selectionEnd;

        if (end > start) {
            return activeElement.value.slice(start, end);
        }
    }

    return null;
}

function getCurrentSelectionText() {
    const inputSelection = getActiveElementSelection();
    if (typeof inputSelection === 'string') {
        return inputSelection;
    }

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
        const text = selection.toString();
        if (text) {
            return text;
        }
    }

    return '';
}

function replaceSelectionWithText(replacementText, originalText) {
    const activeElement = document.activeElement;

    if (activeElement && typeof activeElement.value === 'string' && typeof activeElement.selectionStart === 'number' && typeof activeElement.selectionEnd === 'number') {
        const start = activeElement.selectionStart;
        const end = activeElement.selectionEnd;
        const selectedValue = activeElement.value.slice(start, end);

        if (!originalText || selectedValue === originalText) {
            const newValue = `${activeElement.value.slice(0, start)}${replacementText}${activeElement.value.slice(end)}`;
            activeElement.value = newValue;
            const caret = start + replacementText.length;
            activeElement.selectionStart = caret;
            activeElement.selectionEnd = caret;
            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
            activeElement.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
    }

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const selectedText = range.toString();

        if (!originalText || selectedText === originalText) {
            range.deleteContents();
            const textNode = document.createTextNode(replacementText);
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);
            return true;
        }
    }

    return false;
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (!request) {
        return;
    }

    if (request.type === 'gptProofreadResult') {
        const replaced = replaceSelectionWithText(request.proofreadText, request.originalText);
        if (!replaced) {
            showToast('Unable to replace the previously selected text. Please try again.');
        }
        return;
    }

    if (request.type === 'gptProofreadSelectionRequest') {
        const text = getCurrentSelectionText();
        sendResponse({ text });
        return;
    }

    if (request.message) {
        showToast(request.message);
    }
});
