import * as vscode from 'vscode';

export interface SidebarState {
  connectedAccount: string | null;
  selectedFolder: string | null;
  repoName: string | null;
  autoSync: boolean;
  statusText: string;
  isGitInstalled: boolean;
}

export class SidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly onAction: (action: string, data?: any) => void,
    private currentState: SidebarState
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((data) => {
      this.onAction(data.command, data.payload);
    });

    // Send initial state
    this.update(this.currentState);
  }

  /**
   * Updates the webview with the latest state.
   */
  update(state: SidebarState) {
    this.currentState = state;
    if (this.view) {
      this.view.webview.postMessage({
        type: 'update',
        state: this.currentState
      });
    }
  }

  private getHtmlContent(webview: vscode.Webview): string {
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>GitHub Auto Publisher</title>
  <style>
    :root {
      --font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
      --bg-color: var(--vscode-sideBar-background, #1e1e1e);
      --fg-color: var(--vscode-sideBar-foreground, #cccccc);
      --card-bg: rgba(255, 255, 255, 0.03);
      --card-border: rgba(255, 255, 255, 0.08);
      --accent-color: #0284c7;
      --accent-hover: #0369a1;
      --error-color: #ef4444;
      --success-color: #22c55e;
      --warning-color: #eab308;
    }

    body.vscode-light {
      --card-bg: rgba(0, 0, 0, 0.02);
      --card-border: rgba(0, 0, 0, 0.08);
    }

    body {
      font-family: var(--font-family);
      color: var(--fg-color);
      background-color: transparent;
      padding: 12px 14px;
      margin: 0;
      box-sizing: border-box;
      font-size: 13px;
      user-select: none;
    }

    /* Scrollbar */
    ::-webkit-scrollbar {
      width: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: var(--vscode-scrollbarSlider-background, rgba(255, 255, 255, 0.15));
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: var(--vscode-scrollbarSlider-activeBackground, rgba(255, 255, 255, 0.25));
    }

    h1, h2, h3 {
      margin-top: 0;
      color: var(--vscode-sideBarTitle-foreground, #ffffff);
      font-weight: 600;
    }

    .title-area {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 10px;
    }

    .title-area h2 {
      font-size: 15px;
      margin: 0;
      letter-spacing: 0.5px;
    }

    /* Status dot pulsing animation */
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: var(--warning-color);
      display: inline-block;
      box-shadow: 0 0 8px var(--warning-color);
    }
    .status-dot.active {
      background-color: var(--success-color);
      box-shadow: 0 0 8px var(--success-color);
      animation: pulse 2s infinite;
    }
    .status-dot.syncing {
      background-color: var(--accent-color);
      box-shadow: 0 0 8px var(--accent-color);
      animation: pulse 1s infinite;
    }
    .status-dot.error {
      background-color: var(--error-color);
      box-shadow: 0 0 8px var(--error-color);
    }

    @keyframes pulse {
      0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
      }
      70% {
        transform: scale(1);
        box-shadow: 0 0 0 6px rgba(34, 197, 94, 0);
      }
      100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
      }
    }

    /* Cards */
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .card:hover {
      border-color: rgba(2, 132, 199, 0.4);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    }

    .card-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--vscode-descriptionForeground, #858585);
      margin-bottom: 6px;
      font-weight: 700;
    }

    .card-value {
      font-size: 13px;
      font-weight: 500;
      word-break: break-all;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .empty-text {
      color: var(--vscode-descriptionForeground, #858585);
      font-style: italic;
    }

    /* Status Bar in Panel */
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .status-badge.active {
      color: var(--success-color);
      background: rgba(34, 197, 94, 0.1);
      border-color: rgba(34, 197, 94, 0.2);
    }

    /* Buttons */
    button {
      width: 100%;
      padding: 8px 12px;
      margin-bottom: 8px;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    button:last-child {
      margin-bottom: 0;
    }

    .btn-primary {
      background-color: var(--vscode-button-background, var(--accent-color));
      color: var(--vscode-button-foreground, #ffffff);
    }

    .btn-primary:hover:not(:disabled) {
      background-color: var(--vscode-button-hoverBackground, var(--accent-hover));
      transform: translateY(-1px);
    }

    .btn-secondary {
      background-color: var(--vscode-button-secondaryBackground, rgba(255, 255, 255, 0.08));
      color: var(--vscode-button-secondaryForeground, #cccccc);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .btn-secondary:hover:not(:disabled) {
      background-color: var(--vscode-button-secondaryHoverBackground, rgba(255, 255, 255, 0.15));
      transform: translateY(-1px);
    }

    button:active:not(:disabled) {
      transform: translateY(1px);
    }

    button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    /* Toggle Switch */
    .toggle-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 8px;
    }

    .switch {
      position: relative;
      display: inline-block;
      width: 38px;
      height: 20px;
    }

    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.15);
      transition: .3s;
      border-radius: 20px;
    }

    .slider:before {
      position: absolute;
      content: "";
      height: 14px;
      width: 14px;
      left: 2px;
      bottom: 2px;
      background-color: #ffffff;
      transition: .3s;
      border-radius: 50%;
    }

    input:checked + .slider {
      background-color: var(--success-color);
      border-color: rgba(34, 197, 94, 0.3);
    }

    input:checked + .slider:before {
      transform: translateX(18px);
    }

    .footer {
      text-align: center;
      margin-top: 20px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #858585);
      border-top: 1px solid var(--card-border);
      padding-top: 12px;
    }

    .log-box {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--card-border);
      border-radius: 6px;
      padding: 8px;
      margin-top: 10px;
      max-height: 80px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="title-area">
    <h2>DASHBOARD</h2>
    <div id="statusDot" class="status-dot"></div>
  </div>

  <!-- Account Card -->
  <div class="card">
    <div class="card-label">GitHub Account</div>
    <div id="accountArea" class="card-value">
      <span class="empty-text">Loading...</span>
    </div>
    <div style="margin-top: 10px; display: flex; gap: 8px;">
      <button id="btnConnect" class="btn-primary" style="flex: 1; padding: 6px 10px;">Connect</button>
      <button id="btnDisconnect" class="btn-secondary" style="flex: 1; padding: 6px 10px; display: none;">Disconnect</button>
    </div>
  </div>

  <!-- Folder Card -->
  <div class="card">
    <div class="card-label">Selected Folder</div>
    <div id="folderArea" class="card-value empty-text">
      No folder selected
    </div>
    <div style="margin-top: 10px;">
      <button id="btnSelectFolder" class="btn-secondary">Select Folder</button>
    </div>
  </div>

  <!-- Repository Card -->
  <div class="card">
    <div class="card-label">Connected Repository</div>
    <div id="repoArea" class="card-value empty-text">
      No repository connected
    </div>
    <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px;">
      <button id="btnConnectRepo" class="btn-secondary" disabled>Connect Repository</button>
      <button id="btnCreateRepo" class="btn-secondary" disabled>Create Repository</button>
    </div>
  </div>

  <!-- Sync Controls Card -->
  <div class="card">
    <div class="card-label">Sync Controls</div>
    <button id="btnPublish" class="btn-primary" disabled>
      <svg style="width:16px;height:16px;" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
      </svg>
      Publish Now
    </button>
    
    <div class="toggle-container">
      <span style="font-weight: 500;">Auto Sync Mode</span>
      <label class="switch">
        <input type="checkbox" id="chkAutoSync" disabled>
        <span class="slider"></span>
      </label>
    </div>
  </div>

  <div class="card" id="logCard" style="display: none;">
    <div class="card-label">Activity Log</div>
    <div id="logBox" class="log-box">Idle</div>
  </div>

  <div class="footer">
    GitHub Auto Publisher v2.0.2
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    const statusDot = document.getElementById('statusDot');
    const accountArea = document.getElementById('accountArea');
    const folderArea = document.getElementById('folderArea');
    const repoArea = document.getElementById('repoArea');
    const btnConnect = document.getElementById('btnConnect');
    const btnDisconnect = document.getElementById('btnDisconnect');
    const btnSelectFolder = document.getElementById('btnSelectFolder');
    const btnConnectRepo = document.getElementById('btnConnectRepo');
    const btnCreateRepo = document.getElementById('btnCreateRepo');
    const btnPublish = document.getElementById('btnPublish');
    const chkAutoSync = document.getElementById('chkAutoSync');
    const logCard = document.getElementById('logCard');
    const logBox = document.getElementById('logBox');

    // Attach Event Listeners
    btnConnect.addEventListener('click', () => vscode.postMessage({ command: 'connectAccount' }));
    btnDisconnect.addEventListener('click', () => vscode.postMessage({ command: 'disconnectAccount' }));
    btnSelectFolder.addEventListener('click', () => vscode.postMessage({ command: 'selectFolder' }));
    btnConnectRepo.addEventListener('click', () => vscode.postMessage({ command: 'connectRepo' }));
    btnCreateRepo.addEventListener('click', () => vscode.postMessage({ command: 'createRepo' }));
    btnPublish.addEventListener('click', () => vscode.postMessage({ command: 'publishNow' }));
    chkAutoSync.addEventListener('change', (e) => {
      vscode.postMessage({ command: 'toggleAutoSync', payload: e.target.checked });
    });

    // Handle messages from the extension
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'update') {
        const state = message.state;
        updateUI(state);
      }
    });

    function updateUI(state) {
      // 1. Git Installation check
      if (!state.isGitInstalled) {
        accountArea.innerHTML = '<span class="empty-text" style="color: var(--error-color)">Git is not installed!</span>';
        btnConnect.disabled = true;
        btnSelectFolder.disabled = true;
        return;
      }

      // 2. Account
      if (state.connectedAccount) {
        accountArea.innerHTML = \`<span style="color: var(--success-color); font-weight: bold;">\${state.connectedAccount}</span>\`;
        btnConnect.style.display = 'none';
        btnDisconnect.style.display = 'block';
        btnConnectRepo.disabled = !state.selectedFolder;
        btnCreateRepo.disabled = !state.selectedFolder;
      } else {
        accountArea.innerHTML = '<span class="empty-text">Not Connected</span>';
        btnConnect.style.display = 'block';
        btnDisconnect.style.display = 'none';
        btnConnectRepo.disabled = true;
        btnCreateRepo.disabled = true;
      }

      // 3. Folder
      if (state.selectedFolder) {
        // Show compact file name
        const displayPath = state.selectedFolder;
        folderArea.textContent = displayPath;
        folderArea.className = 'card-value';
        btnConnectRepo.disabled = !state.connectedAccount;
        btnCreateRepo.disabled = !state.connectedAccount;
      } else {
        folderArea.textContent = 'No folder selected';
        folderArea.className = 'card-value empty-text';
        btnConnectRepo.disabled = true;
        btnCreateRepo.disabled = true;
      }

      // 4. Repository
      if (state.repoName) {
        repoArea.textContent = state.repoName;
        repoArea.className = 'card-value';
        btnPublish.disabled = !state.selectedFolder;
        chkAutoSync.disabled = !state.selectedFolder;
      } else {
        repoArea.textContent = 'No repository connected';
        repoArea.className = 'card-value empty-text';
        btnPublish.disabled = true;
        chkAutoSync.disabled = true;
      }

      // 5. Auto Sync
      chkAutoSync.checked = state.autoSync;

      // 6. Status dot & Activity logs
      if (state.statusText) {
        logCard.style.display = 'block';
        logBox.textContent = state.statusText;
        
        if (state.statusText.includes('Syncing') || state.statusText.includes('Uploading')) {
          statusDot.className = 'status-dot syncing';
        } else if (state.statusText.toLowerCase().includes('error')) {
          statusDot.className = 'status-dot error';
        } else if (state.statusText.includes('Watching') || state.statusText.includes('Ready')) {
          statusDot.className = 'status-dot active';
        } else {
          statusDot.className = 'status-dot';
        }
      } else {
        logCard.style.display = 'none';
        statusDot.className = 'status-dot';
      }
    }
  </script>
</body>
</html>`;
  }

  private getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
