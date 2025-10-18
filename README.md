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

## 📦 Install
### Chrome (MV3)
1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and choose the `chrome/` directory from this repository.
3. Open the popup, paste your OpenAI API key, and click **Save API Key**.
4. (Optional) Visit the options page to set your preferred tone.

### Safari
1. Open the project in **Xcode**.
2. Select the **Safari Web Extension** target.
3. Press **Run** (**⌘R**) to build and install the temporary app.
4. In Safari, open **Preferences → Extensions** and enable *Safari GPT Proofreader*.
5. Open the extension options page to save your API key before testing.

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

## 🧳 Packaging
### Chrome
1. Run `./scripts/package_chrome.sh` from the repository root.
2. Load `dist/chrome/unpacked` for local testing or distribute `dist/chrome/safari-gpt-proofreader-chrome.zip`.

### Safari (Xcode)
1. In Xcode select the **Safari Web Extension** target.
2. Choose **Product → Archive** to produce a signed build.
3. Use the Organizer to export the app bundle, install it, then enable the extension from **Preferences → Extensions**.

---

## 🛠 Quick debug
- Open the options page and enable **Debug logging**.
- Note the extension ID from `chrome://extensions` (or Safari’s Develop → Show Extension Builder) and open `debug.html` manually, e.g. `chrome-extension://<id>/debug.html`, to inspect storage, last error, and run the round-trip self-test.
- Badge text **ERR** with a title ending in “No content script on this page” means the active tab cannot be updated (e.g., PDF viewer or restricted page). Return to a normal webpage and try again.

---

## 🧪 Test
### Chrome
- Select text on a regular page and use the popup **Proofread selection** button. Watch the status line for the spinner, then confirm only the highlighted text is replaced.
- Right-click the same selection, choose **Proofread with GPT**, switch to another tab, and verify the correction lands back in the original tab.
- Visit a restricted page (e.g., Chrome Web Store or a PDF), trigger proofreading, and confirm the badge shows **ERR** with the fallback title.

### Safari
- Enable the extension in **Preferences → Extensions**, open the options page, and save your API key.
- Use the popup on a normal webpage to proofread a highlighted selection.
- Trigger the context menu flow and confirm results return to the originating tab or surface the badge fallback on restricted pages.

---

## ❓ Troubleshooting
| Symptom | Fix |
| --- | --- |
| Popup says “Please enter a valid API Key.” | Open the popup or options page and save a valid OpenAI API key. |
| Toast reports that no text was selected. | Highlight the text again and make sure it contains more than whitespace before running the command. |
| Badge shows **ERR** with “No content script on this page.” | The page blocks scripts (e.g., Chrome Web Store, PDFs). Switch to a standard webpage and retry. |
| Badge shows **!** and storage errors appear. | Reopen the options page, resave your settings, and use `debug.html` to confirm storage access succeeds. |

---

## 🛡 Security Notes
- `.gitignore` prevents secret files from being committed
- OpenAI key only used during user requests
- No analytics/tracking of any kind

---

## 🔜 Roadmap
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
