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
