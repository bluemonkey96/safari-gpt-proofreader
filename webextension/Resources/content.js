const TOAST_CONTAINER_ID = "gpt-proofreader-toast-container";
const TOAST_LIFETIME_MS = 4000;

let debugEnabled = false;
let lastSelectionContext = null;

const MAX_FRAME_DEPTH = 4;

function debugLog(event, payload = {}) {
    if (debugEnabled) {
        try {
            console.debug('[proofreader:content]', event, payload);
        } catch (error) {
            // Ignore logging failures.
        }
    }
}

function readDebugFlag() {
    try {
        chrome.storage.local.get(['debug_enabled'], (result) => {
            if (chrome.runtime.lastError) {
                debugLog('storage:get:error', { message: chrome.runtime.lastError.message });
                return;
            }
            debugEnabled = Boolean(result && result.debug_enabled);
            debugLog('debug:flag:update', { enabled: debugEnabled });
        });
    } catch (error) {
        debugLog('storage:get:exception', { message: error.message });
    }
}

readDebugFlag();

if (chrome.storage && typeof chrome.storage.onChanged?.addListener === 'function') {
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && Object.prototype.hasOwnProperty.call(changes, 'debug_enabled')) {
            debugEnabled = Boolean(changes.debug_enabled.newValue);
            debugLog('debug:flag:update', { enabled: debugEnabled });
        }
    });
}

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
    debugLog('toast:show', { message });
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

function isFrameElement(element) {
    if (!element || typeof element.tagName !== 'string') {
        return false;
    }
    const tag = element.tagName.toUpperCase();
    return tag === 'IFRAME' || tag === 'FRAME';
}

function safeGetActiveElement(doc) {
    if (!doc) {
        return null;
    }

    try {
        return doc.activeElement;
    } catch (error) {
        debugLog('activeElement:error', { message: error.message });
        return null;
    }
}

function safeGetSelection(targetWindow) {
    if (!targetWindow) {
        return null;
    }

    try {
        return targetWindow.getSelection();
    } catch (error) {
        debugLog('selection:error', { message: error.message });
        return null;
    }
}

function readSelectionFromWindow(targetWindow, depth = 0) {
    if (!targetWindow || depth > MAX_FRAME_DEPTH) {
        return { text: '', context: null };
    }

    const doc = targetWindow.document;
    if (!doc) {
        return { text: '', context: null };
    }

    const activeElement = safeGetActiveElement(doc);

    if (activeElement) {
        if (isFrameElement(activeElement)) {
            try {
                const frameWindow = activeElement.contentWindow;
                if (frameWindow) {
                    const frameResult = readSelectionFromWindow(frameWindow, depth + 1);
                    if (frameResult.text) {
                        return frameResult;
                    }
                }
            } catch (error) {
                debugLog('iframe:selection:error', { message: error.message });
            }
        }

        if (typeof activeElement.value === 'string' && typeof activeElement.selectionStart === 'number' && typeof activeElement.selectionEnd === 'number') {
            const start = activeElement.selectionStart;
            const end = activeElement.selectionEnd;

            if (end > start) {
                const text = activeElement.value.slice(start, end);
                return {
                    text,
                    context: {
                        kind: 'input',
                        element: activeElement,
                        start,
                        end,
                        window: targetWindow,
                        text
                    }
                };
            }
        }

        if (activeElement.isContentEditable) {
            const selection = safeGetSelection(targetWindow);
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0).cloneRange();
                const text = range.toString();
                if (text) {
                    return {
                        text,
                        context: {
                            kind: 'range',
                            range,
                            window: targetWindow,
                            text
                        }
                    };
                }
            }
        }
    }

    const selection = safeGetSelection(targetWindow);
    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0).cloneRange();
        const text = range.toString();
        if (text) {
            return {
                text,
                context: {
                    kind: 'range',
                    range,
                    window: targetWindow,
                    text
                }
            };
        }
    }

    return { text: '', context: null };
}

function getCurrentSelectionText(options = {}) {
    const { notifyOnEmpty = false } = options;
    const result = readSelectionFromWindow(window);

    lastSelectionContext = result.context ? { ...result.context } : null;

    const text = result.text || '';
    if (!text.trim()) {
        if (notifyOnEmpty) {
            showToast('Please select some text to proofread before trying again.');
        }
        return '';
    }

    return text;
}

function dispatchContentEditableInput(range) {
    const container = range && range.commonAncestorContainer;
    if (!container) {
        return;
    }

    let element = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement;
    while (element && !element.isContentEditable) {
        element = element.parentElement;
    }

    if (element) {
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

function applyInputReplacement(context, replacementText, originalText) {
    const element = context && context.element;
    if (!element || typeof element.value !== 'string') {
        return false;
    }

    const { start, end } = context;
    if (typeof start !== 'number' || typeof end !== 'number' || end <= start) {
        return false;
    }

    const slice = element.value.slice(start, end);
    if (originalText && originalText.trim() && slice !== originalText) {
        return false;
    }

    try {
        element.focus?.();
        if (typeof element.setRangeText === 'function') {
            element.setRangeText(replacementText, start, end, 'end');
        } else {
            const before = element.value.slice(0, start);
            const after = element.value.slice(end);
            element.value = `${before}${replacementText}${after}`;
            const caret = start + replacementText.length;
            if (typeof element.setSelectionRange === 'function') {
                element.setSelectionRange(caret, caret);
            } else {
                element.selectionStart = caret;
                element.selectionEnd = caret;
            }
        }
    } catch (error) {
        debugLog('replace:input:error', { message: error.message });
        return false;
    }

    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
}

function applyRangeReplacement(context, replacementText, originalText) {
    const range = context && context.range;
    if (!range || typeof range.deleteContents !== 'function') {
        return false;
    }

    const currentText = range.toString();
    if (originalText && originalText.trim() && currentText !== originalText && currentText.trim() !== originalText.trim()) {
        return false;
    }

    const targetWindow = context.window || (range.startContainer && range.startContainer.ownerDocument ? range.startContainer.ownerDocument.defaultView : null);
    const doc = range.startContainer && range.startContainer.ownerDocument ? range.startContainer.ownerDocument : (targetWindow ? targetWindow.document : null);

    if (!doc) {
        return false;
    }

    try {
        targetWindow?.focus?.();
        const textNode = doc.createTextNode(replacementText);
        range.deleteContents();
        range.insertNode(textNode);

        const selection = safeGetSelection(targetWindow || doc.defaultView);
        if (selection) {
            selection.removeAllRanges();
            const caretRange = doc.createRange();
            caretRange.setStartAfter(textNode);
            caretRange.collapse(true);
            selection.addRange(caretRange);
        }

        dispatchContentEditableInput(range);
        return true;
    } catch (error) {
        debugLog('replace:range:error', { message: error.message });
        return false;
    }
}

function replaceSelectionWithTextFallback(replacementText, originalText) {
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
            debugLog('replace:inputElement:fallback', {});
            return true;
        }
    }

    const selection = safeGetSelection(window);
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
            dispatchContentEditableInput(range);
            debugLog('replace:contentEditable:fallback', {});
            return true;
        }
    }

    return false;
}

function replaceSelectionWithText(replacementText, originalText) {
    debugLog('replace:start', {
        hasContext: Boolean(lastSelectionContext),
        originalLength: originalText ? originalText.length : 0,
        replacementLength: replacementText ? replacementText.length : 0
    });

    let replaced = false;

    if (lastSelectionContext) {
        if (lastSelectionContext.kind === 'input') {
            replaced = applyInputReplacement(lastSelectionContext, replacementText, originalText);
        } else if (lastSelectionContext.kind === 'range') {
            replaced = applyRangeReplacement(lastSelectionContext, replacementText, originalText);
        }

        if (!replaced) {
            debugLog('replace:context:failed', { kind: lastSelectionContext.kind });
        }
    }

    if (!replaced) {
        replaced = replaceSelectionWithTextFallback(replacementText, originalText);
    }

    if (replaced) {
        lastSelectionContext = null;
        debugLog('replace:ok', {});
        return true;
    }

    debugLog('replace:failed');
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
            debugLog('proofread:apply:failed', {});
        } else {
            debugLog('proofread:apply:ok', { length: request.proofreadText ? request.proofreadText.length : 0 });
        }
        return;
    }

    if (request.type === 'gptProofreadSelectionRequest') {
        const text = getCurrentSelectionText({ notifyOnEmpty: Boolean(request.notifyOnEmpty) });
        sendResponse({ text });
        return;
    }

    if (request.type === 'gptProofreaderPing') {
        if (typeof sendResponse === 'function') {
            sendResponse({ ok: true });
        }
        debugLog('ping:received');
        return;
    }

    if (request.message) {
        showToast(request.message);
    }
});
