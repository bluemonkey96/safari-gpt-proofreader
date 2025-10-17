# Safari GPT Proofreader

<p align="center">
  <img src="webextension/Resources/images/logo.png" width="120" alt="Safari GPT Proofreader logo"/>
</p>

**Safari GPT Proofreader** is a Safari Web Extension that lets you select text on any web page and instantly proofread it with OpenAI GPT from the right‑click menu. It improves grammar, spelling, clarity and tone. The codebase follows the WebExtension standard, so it can also be loaded in Chromium browsers.

---

## ✨ Features
- Right‑click → **Proofread with GPT**
- Works with `textarea`, `input` and `contenteditable`
- Local storage of API key (never in source control)
- Options page + popup UI
- Safari (Xcode) and Chrome/Edge compatible

## 📂 Project Structure
```
webextension/
  Info.plist
  SafariWebExtensionHandler.swift
  safari_gpt_proofreader_Extension.entitlements
  Resources/
    manifest.json
    background.js
    content.js
    options.html
    options.js
    popup.html
    popup.js
    popup.css
    images/
    _locales/
```

## 🚀 Getting Started

### Safari (Xcode)
1. Open the project in **Xcode**.
2. Select the **Safari Web Extension** target.
3. Run with **⌘R** and enable the extension in Safari.
4. Select text on any page → right‑click → *Proofread with GPT*.

### Chrome / Edge (manual load)
1. Navigate to `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select `webextension/Resources`.
3. Open **Options** and paste your API key.

## 🔑 OpenAI API Key
- Never commit real keys to the repo.
- Enter your key via the **Options** page (`sk-...`).
- It is stored locally using `chrome.storage.local` (and Safari’s equivalent).

## 🧠 API Call Example
```js
await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "You are a concise proofreading assistant." },
      { role: "user", content: selectedText }
    ]
  })
});
```

## 🛡️ Security Practices
- Use **Options UI** + local storage for secrets.
- Keep `backup/` or local-only folders ignored in `.gitignore`.
- GitHub **Push Protection** + secret scanning recommended.

## 🗺️ Roadmap
- Tone presets (formal/casual/friendly)
- Multilingual proofreading
- Model selection
- Chrome Web Store & Safari App Store releases

## 👥 Contributors
- @bluemonkey96 (maintainer)

## 📄 License
MIT — free to use and modify.
