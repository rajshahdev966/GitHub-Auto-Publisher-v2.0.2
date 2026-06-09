# GitHub Auto Publisher — Auto-Sync & Backup to GitHub

[![Version](https://img.shields.io/visual-studio-marketplace/v/rajshah.github-auto-publisher?style=for-the-badge&logo=visual-studio-code)](https://marketplace.visualstudio.com/)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/rajshah.github-auto-publisher?style=for-the-badge)](https://marketplace.visualstudio.com/)
[![License](https://img.shields.io/github/license/rajshahdev966/JS-Learn-Everything?style=for-the-badge)](https://github.com/)

**GitHub Auto Publisher** is an SEO-optimized, production-ready Visual Studio Code extension designed for developers, bloggers, writers, and students who want to automatically or manually back up and sync their files to GitHub. 

Say goodbye to manual `git add`, `git commit`, and `git push` command-line cycles. Sync your portfolios, JS learning scripts, notes, or project folders with one click or completely in the background.

---

## 🎯 Why Use GitHub Auto Publisher?

* **Seamless VS Code Native Login**: Connect your account securely using the built-in VS Code GitHub provider. No need to create, copy, or paste Personal Access Tokens (PATs).
* **Automatic Background Syncing**: Watches your folder for new, modified, or deleted files and automatically pushes them to GitHub after a configurable debounce delay.
* **One-Click Manual Publish**: Instantly stage, commit, and push your changes on-demand using a single dashboard button.
* **Local Repo Safety First**: Confines Git commands strictly to the selected folder, preventing accidental commits or pushes from parent directories (e.g. your User Home folder).
* **Zero Command-Line Friction**: Handles Git initialization, `.gitignore` creation, branch switching, and local Git author identity setups automatically.

---

## 📸 Extension Dashboard

Below is a preview of the clean, theme-adaptive dashboard available in your VS Code Activity Bar:

![GitHub Auto Publisher Dashboard](media/dashboard_screenshot.png)

---

## 🛠️ Step-by-Step Setup Guide

Getting started is simple and takes less than a minute:

### 1. Connect GitHub Account
Click **Connect** in the sidebar. A native VS Code prompt will request sign-in access. Confirm the browser redirection to link your GitHub profile.

### 2. Select Your Local Folder
Click **Select Folder** to specify the directory you want to sync. 
* *If the folder is not a Git repository*, the extension will offer to initialize it and create a default `.gitignore` for you.

### 3. Link a Repository
* **Connect Existing**: Select from a dropdown list of your pre-existing repositories.
* **Create New**: Create a brand new public or private repository directly from VS Code.

### 4. Start Publishing!
* Turn on **Auto Sync Mode** for background synchronization.
* Or click **Publish Now** to run a manual commit and push on-demand.

---

## ⚙️ Extension Settings

Customize how the extension publishes files in your user settings panel (`Ctrl+,` or `Cmd+,` -> search `GitHub Auto Publisher`):

| Setting | Default | Description |
| :--- | :--- | :--- |
| `githubAutoPublisher.autoSync` | `false` | Enable background directory watching and auto-syncing. |
| `githubAutoPublisher.selectedFolder` | `""` | Local path of the folder that is tracked and synced. |
| `githubAutoPublisher.defaultBranch` | `"main"` | The default remote branch to push changes to. |
| `githubAutoPublisher.debounceSeconds` | `30` | Time (in seconds) to wait after file changes settle before auto-pushing. |
| `githubAutoPublisher.commitMessageTemplate` | `""` | Customize your commit messages. If left blank, a random message (e.g., *Update project files*) is chosen. |

---

## 🛠️ Troubleshooting & FAQ

#### Q: I get the error "Author identity unknown" when publishing.
**A:** If Git doesn't know who you are, it halts commits. **GitHub Auto Publisher fixes this automatically** by configuring a local repository fallback username and email using your connected GitHub account.

#### Q: Is my GitHub token secure?
**A:** Yes. The extension uses VS Code's official credential manager, so no passwords or tokens are stored in plain text or exposure-prone local configuration files.

#### Q: How do I change the repository linked to the folder?
**A:** You can change it at any time by clicking **Connect Repository** or **Create Repository** in the dashboard, which re-maps your local Git `origin` remote.
