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

chrome.runtime.onMessage.addListener((request) => {
    if (request && request.message) {
        showToast(request.message);
    }
});
