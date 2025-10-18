<p align="center">
  <img src="webextension/Resources/images/logo.png" width="120" alt="Safari GPT Proofreader logo"/>
</p>

<h1 align="center">Safari GPT Proofreader</h1>

<p align="center">
  A Safari WebExtension that lets you proofread selected text using OpenAI GPT directly from the right-click menu.
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="Platform" src="https://img.shields.io/badge/platform-Safari%20%7C%20Chrome%20%7C%20Edge-black">
  <img alt="Status" src="https://img.shields.io/badge/status-active-brightgreen">
</p>

---

## ✨ Features
- Right-click → **“Proofread with GPT”**
- Improves grammar, spelling and clarity
- Works on inputs, textareas and editable content
- Saves your OpenAI API key locally
- Safari compatible via Xcode / WebExtension

---

## 🚀 Installation (Safari via Xcode)
1. Open the project in **Xcode**
2. Choose the **Safari Web Extension** target
3. Press **Run** (**⌘R**)
4. Enable the extension in Safari preferences
5. Highlight text → right-click → ✅ Done!

---

## 🔧 Installation (Chrome/Edge Manual)
1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `webextension/Resources`
5. Enter API key in Options → start proofreading ✅

---

## 🔑 OpenAI API Key Safety
Your API key is stored **only locally** via `chrome.storage.local`.  
✔ Not uploaded  
✔ Not shared  
✔ Not in git history  

---

## 📂 Project Structure
```
webextension/
  Info.plist
  SafariWebExtensionHandler.swift
  Resources/
    manifest.json
    background.js
    content.js
    popup.html
    popup.js
    popup.css
    options.html
    options.js
    images/
```

---

## 🛠 Quick debug
- Open **Options** from the extension menu and enable **Debug logging**.
- A **Debug tools** link appears – open it to view the storage snapshot, last recorded error, and run the self-test.
- Badge text **ERR** with a title ending in “No content script on this page” means the active tab cannot be updated (e.g., PDF viewer or restricted page). Return to a normal webpage and try again.

---

## ✅ Manual test checklist
- Popup proofreading: select text, trigger **Proofread selection**, wait for status, and confirm only the selection changes.
- Context menu proofreading: capture text from one tab, switch tabs while it processes, and verify the result returns to the original tab.
- Restricted-page fallback: open a PDF/restricted page, trigger proofreading, and confirm the badge shows **ERR** with the fallback title.
- Storage resilience: disable network or clear storage to confirm option save/load errors show a toast and the badge marks storage failures.

---

## 🛡 Security Notes
- `.gitignore` prevents secret files from being committed
- OpenAI key only used during user requests
- No analytics/tracking of any kind

---

## 🔜 Roadmap
- Chrome MV3 packaging
- Publish to Chrome Web Store
- Better UI
- Add grammar/tone options

---

## 🧩 Contribute
Pull requests welcome!  
Found an issue? Open one on GitHub. 🚀

---

## 📜 License
MIT License © 2025  
Use freely. Improve. Share.
