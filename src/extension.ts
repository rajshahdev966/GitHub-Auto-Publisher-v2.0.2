import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { GitService } from './services/gitService';
import { GitHubService } from './services/githubService';
import { UiService } from './services/uiService';
import { WatcherService } from './services/watcherService';
import { SidebarProvider, SidebarState } from './views/sidebarProvider';

export async function activate(context: vscode.ExtensionContext) {
  // 1. Initialize Services
  const gitService = new GitService();
  const githubService = new GitHubService();
  const uiService = new UiService();
  
  let connectedAccount: string | null = null;
  let selectedFolder: string | null = null;
  let repoName: string | null = null;
  let autoSync = false;
  let statusText = 'Extension initialized.';
  let isGitInstalled = false;
  let isCurrentlySyncing = false;

  // Local helper: Generate state for sidebar Webview
  function getSidebarState(): SidebarState {
    return {
      connectedAccount,
      selectedFolder,
      repoName,
      autoSync,
      statusText,
      isGitInstalled
    };
  }

  // Local helper: Refresh extension state and notify UI
  async function refreshState() {
    isGitInstalled = await gitService.isGitInstalled();
    if (!isGitInstalled) {
      statusText = 'Git is not installed on your system.';
      uiService.updateStatusBar('Error', 'Git not found');
      sidebarProvider.update(getSidebarState());
      return;
    }

    // Load selected folder
    const config = vscode.workspace.getConfiguration('githubAutoPublisher');
    selectedFolder = config.get<string>('selectedFolder') || null;

    // Detect Git Repo & remote URL
    if (selectedFolder && fs.existsSync(selectedFolder)) {
      const isRepo = await gitService.isGitRepository(selectedFolder);
      if (isRepo) {
        const url = await gitService.getRemoteUrl(selectedFolder);
        if (url) {
          repoName = getDisplayRepoName(url);
        } else {
          repoName = 'No remote repository connected';
        }
      } else {
        repoName = 'Not a Git repository';
      }
    } else {
      repoName = null;
    }

    // Load autoSync setting
    autoSync = config.get<boolean>('autoSync') || false;

    // Load Token & Account details
    const isConnected = context.globalState.get<boolean>('isConnected', false);
    if (isConnected) {
      try {
        const session = await vscode.authentication.getSession('github', ['repo'], { silent: true });
        if (session) {
          connectedAccount = session.account.label;
          if (!isCurrentlySyncing) {
            uiService.updateStatusBar('Ready');
          }
        } else {
          connectedAccount = null;
          uiService.updateStatusBar('Disconnected');
        }
      } catch (e: any) {
        connectedAccount = null;
        statusText = `Authentication error: ${e.message}`;
        uiService.updateStatusBar('Error', 'Authentication failed');
      }
    } else {
      connectedAccount = null;
      uiService.updateStatusBar('Disconnected');
    }

    // Watcher activation
    if (autoSync && selectedFolder && repoName && repoName !== 'Not a Git repository' && repoName !== 'No remote repository connected' && connectedAccount) {
      if (!watcherService.isWatching()) {
        const debounceSeconds = config.get<number>('debounceSeconds') || 30;
        watcherService.start(selectedFolder, debounceSeconds);
        statusText = `Watching folder for changes...`;
        uiService.updateStatusBar('Ready', 'Watching folder');
      }
    } else {
      watcherService.stop();
      if (!selectedFolder) {
        statusText = 'Please select a folder to begin.';
      } else if (!connectedAccount) {
        statusText = 'Please connect your GitHub account.';
      } else if (repoName === 'Not a Git repository' || repoName === 'No remote repository connected') {
        statusText = 'Please connect or create a repository for this folder.';
      } else {
        statusText = 'Ready.';
      }
    }

    sidebarProvider.update(getSidebarState());
  }

  // Debounced auto sync handler
  const watcherService = new WatcherService(
    async (changedFiles) => {
      // Triggered after debounce timeout
      if (isCurrentlySyncing) {
        return;
      }
      
      const fileCount = changedFiles.length;
      statusText = `Changes detected (${fileCount} files). Auto syncing...`;
      uiService.updateStatusBar('Syncing', `Syncing ${fileCount} files...`);
      sidebarProvider.update(getSidebarState());

      try {
        isCurrentlySyncing = true;
        const config = vscode.workspace.getConfiguration('githubAutoPublisher');
        const isConnected = context.globalState.get<boolean>('isConnected', false);
        if (!isConnected) {
          throw new Error('GitHub token not found. Connect account first.');
        }
        const session = await vscode.authentication.getSession('github', ['repo'], { silent: true });
        if (!session) {
          throw new Error('GitHub session not found. Connect account first.');
        }
        const token = session.accessToken;
        if (!selectedFolder) {
          throw new Error('No folder selected.');
        }

        // Generate Commit Message
        let commitMessage = config.get<string>('commitMessageTemplate') || '';
        if (!commitMessage.trim()) {
          const templates = [
            'Update project files',
            'Auto sync changes',
            'Updated portfolio content',
            'Modified website assets'
          ];
          commitMessage = templates[Math.floor(Math.random() * templates.length)];
        }

        // Update remote URL with token if it's currently clean HTTPS and not authenticated
        const currentUrl = await gitService.getRemoteUrl(selectedFolder);
        if (currentUrl && currentUrl.startsWith('https://github.com/') && !currentUrl.includes('@')) {
          const authUrl = githubService.getAuthenticatedUrl(currentUrl, token);
          await gitService.addRemote(selectedFolder, authUrl);
        }

        const branch = config.get<string>('defaultBranch') || 'main';

        await gitService.publishFiles(selectedFolder, commitMessage, branch, connectedAccount || undefined);

        statusText = `Auto sync successful! Pushed ${fileCount} files at ${new Date().toLocaleTimeString()}.`;
        uiService.updateStatusBar('Ready', 'Last sync successful');
        uiService.showInfo('Auto sync complete: files pushed to GitHub.');
      } catch (err: any) {
        statusText = `Auto sync error: ${err.message}`;
        uiService.updateStatusBar('Error', err.message);
        uiService.showError(`Auto sync failed: ${err.message}`);
      } finally {
        isCurrentlySyncing = false;
        await refreshState();
      }
    },
    (detail) => {
      statusText = detail;
      sidebarProvider.update(getSidebarState());
    }
  );

  // 2. Register Sidebar Webview
  const sidebarProvider = new SidebarProvider(
    context.extensionUri,
    async (command, payload) => {
      // Handles Webview actions
      switch (command) {
        case 'connectAccount':
          await vscode.commands.executeCommand('githubAutoPublisher.connectAccount');
          break;
        case 'disconnectAccount':
          await vscode.commands.executeCommand('githubAutoPublisher.disconnectAccount');
          break;
        case 'selectFolder':
          await vscode.commands.executeCommand('githubAutoPublisher.selectFolder');
          break;
        case 'connectRepo':
          await vscode.commands.executeCommand('githubAutoPublisher.connectRepository');
          break;
        case 'createRepo':
          await vscode.commands.executeCommand('githubAutoPublisher.createRepository');
          break;
        case 'publishNow':
          await vscode.commands.executeCommand('githubAutoPublisher.publish');
          break;
        case 'toggleAutoSync':
          const config = vscode.workspace.getConfiguration('githubAutoPublisher');
          await config.update('autoSync', payload, vscode.ConfigurationTarget.Global);
          break;
      }
    },
    getSidebarState()
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'github-auto-publisher-sidebar',
      sidebarProvider
    )
  );

  // 3. Register Commands

  // Command: Connect GitHub Account
  const connectAccountCmd = vscode.commands.registerCommand('githubAutoPublisher.connectAccount', async () => {
    try {
      await uiService.showProgress('Connecting to GitHub...', async (progress) => {
        progress.report({ message: 'Requesting VS Code GitHub session...' });
        const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true });
        
        if (session) {
          await context.globalState.update('isConnected', true);
          connectedAccount = session.account.label;
          statusText = `Connected as ${connectedAccount}`;
          uiService.showInfo(`Successfully connected to GitHub as ${connectedAccount}`);
        } else {
          throw new Error('Authentication session cancelled.');
        }
      });
      await refreshState();
    } catch (e: any) {
      uiService.showError(`Connection failed: ${e.message}`);
      await refreshState();
    }
  });

  // Command: Disconnect GitHub Account
  const disconnectAccountCmd = vscode.commands.registerCommand('githubAutoPublisher.disconnectAccount', async () => {
    const confirm = await vscode.window.showWarningMessage(
      'Are you sure you want to disconnect your GitHub account?',
      'Yes', 'No'
    );
    if (confirm === 'Yes') {
      await context.globalState.update('isConnected', false);
      connectedAccount = null;
      statusText = 'Disconnected GitHub account.';
      uiService.showInfo('Disconnected GitHub account.');
      await refreshState();
    }
  });

  // Command: View Connected Account
  const viewConnectedAccountCmd = vscode.commands.registerCommand('githubAutoPublisher.viewConnectedAccount', () => {
    if (connectedAccount) {
      uiService.showInfo(`Connected as GitHub user: ${connectedAccount}`);
    } else {
      uiService.showInfo('No GitHub account connected.');
    }
  });

  // Command: Select Local Folder
  const selectFolderCmd = vscode.commands.registerCommand('githubAutoPublisher.selectFolder', async () => {
    const folderUri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      title: 'Select Folder to Publish'
    });

    if (!folderUri || folderUri.length === 0) {
      return;
    }

    const folderPath = folderUri[0].fsPath;
    const config = vscode.workspace.getConfiguration('githubAutoPublisher');
    await config.update('selectedFolder', folderPath, vscode.ConfigurationTarget.Global);

    // Check if it's already a Git repository
    const isRepo = await gitService.isGitRepository(folderPath);
    if (!isRepo) {
      const initConfirm = await vscode.window.showInformationMessage(
        'The selected folder is not a Git repository. Would you like to initialize it and add a default .gitignore?',
        'Yes', 'No'
      );
      if (initConfirm === 'Yes') {
        try {
          await gitService.initRepository(folderPath);
          await gitService.createGitIgnore(folderPath);
          uiService.showInfo('Initialized Git repository & created .gitignore.');
        } catch (e: any) {
          uiService.showError(`Failed to initialize Git: ${e.message}`);
        }
      }
    }

    await refreshState();
  });

  // Helper to ensure the target folder is a Git repository, initializing it if not.
  async function ensureGitRepository(folderPath: string): Promise<boolean> {
    const isRepo = await gitService.isGitRepository(folderPath);
    if (!isRepo) {
      try {
        await gitService.initRepository(folderPath);
        await gitService.createGitIgnore(folderPath);
        uiService.showInfo('Initialized local Git repository & created .gitignore.');
        return true;
      } catch (e: any) {
        uiService.showError(`Failed to initialize Git repository: ${e.message}`);
        return false;
      }
    }
    return true;
  }

  // Command: Connect existing GitHub repository
  const connectRepositoryCmd = vscode.commands.registerCommand('githubAutoPublisher.connectRepository', async () => {
    if (!selectedFolder) {
      uiService.showError('Please select a local folder first.');
      return;
    }
    if (!await ensureGitRepository(selectedFolder)) {
      return;
    }
    const session = await vscode.authentication.getSession('github', ['repo'], { silent: true });
    if (!session) {
      uiService.showError('Please connect your GitHub account first.');
      return;
    }
    const token = session.accessToken;

    try {
      await uiService.showProgress('Fetching GitHub Repositories...', async (progress) => {
        progress.report({ message: 'Loading...' });
        const repos = await githubService.getUserRepositories(token);
        
        if (repos.length === 0) {
          throw new Error('No repositories found on your GitHub account.');
        }

        const items = repos.map(repo => ({
          label: repo.name,
          description: repo.private ? 'Private' : 'Public',
          detail: repo.full_name,
          cloneUrl: repo.clone_url
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a GitHub repository to connect to',
          ignoreFocusOut: true
        });

        if (selected) {
          progress.report({ message: 'Configuring Git remote...' });
          const authUrl = githubService.getAuthenticatedUrl(selected.cloneUrl, token);
          await gitService.addRemote(selectedFolder!, authUrl);
          uiService.showInfo(`Successfully connected to repository ${selected.label}`);
        }
      });
      await refreshState();
    } catch (e: any) {
      uiService.showError(`Failed to connect repository: ${e.message}`);
      await refreshState();
    }
  });

  // Command: Create new GitHub repository
  const createRepositoryCmd = vscode.commands.registerCommand('githubAutoPublisher.createRepository', async () => {
    if (!selectedFolder) {
      uiService.showError('Please select a local folder first.');
      return;
    }
    if (!await ensureGitRepository(selectedFolder)) {
      return;
    }
    const session = await vscode.authentication.getSession('github', ['repo'], { silent: true });
    if (!session) {
      uiService.showError('Please connect your GitHub account first.');
      return;
    }
    const token = session.accessToken;

    const defaultName = path.basename(selectedFolder);
    const repoNameInput = await vscode.window.showInputBox({
      prompt: 'Enter a name for the new GitHub repository',
      value: defaultName,
      ignoreFocusOut: true
    });

    if (!repoNameInput) {
      return;
    }

    const visibility = await vscode.window.showQuickPick(
      ['Private', 'Public'],
      { placeHolder: 'Select repository visibility', ignoreFocusOut: true }
    );

    if (!visibility) {
      return;
    }

    const isPrivate = visibility === 'Private';

    try {
      await uiService.showProgress('Creating GitHub Repository...', async (progress) => {
        progress.report({ message: 'Creating on GitHub...' });
        const cloneUrl = await githubService.createRepository(token, repoNameInput, isPrivate);
        
        progress.report({ message: 'Configuring local remote...' });
        const authUrl = githubService.getAuthenticatedUrl(cloneUrl, token);
        await gitService.addRemote(selectedFolder!, authUrl);
        
        uiService.showInfo(`Successfully created and connected repository "${repoNameInput}"!`);
      });
      await refreshState();
    } catch (e: any) {
      uiService.showError(`Failed to create repository: ${e.message}`);
      await refreshState();
    }
  });

  // Command: Publish to GitHub (One click manual publish)
  const publishCmd = vscode.commands.registerCommand('githubAutoPublisher.publish', async () => {
    if (isCurrentlySyncing) {
      uiService.showInfo('A publish operation is already in progress.');
      return;
    }

    if (!selectedFolder) {
      uiService.showError('No folder selected. Select folder first.');
      return;
    }

    if (!await ensureGitRepository(selectedFolder)) {
      return;
    }

    const currentUrl = await gitService.getRemoteUrl(selectedFolder);
    if (!currentUrl) {
      uiService.showError('No Git remote configured. Connect or create repository first.');
      return;
    }

    const session = await vscode.authentication.getSession('github', ['repo'], { silent: true });
    if (!session) {
      uiService.showError('Please connect your GitHub account to authenticate.');
      return;
    }
    const token = session.accessToken;

    const config = vscode.workspace.getConfiguration('githubAutoPublisher');
    const defaultCommitMessage = config.get<string>('commitMessageTemplate') || '';
    const placeholderMessage = defaultCommitMessage.trim() || `Manual publish - ${new Date().toLocaleString()}`;

    const commitMessageInput = await vscode.window.showInputBox({
      prompt: 'Enter a commit message (or leave blank to use default)',
      placeHolder: placeholderMessage,
      value: defaultCommitMessage,
      ignoreFocusOut: true
    });

    // If user pressed Escape / cancelled the input box
    if (commitMessageInput === undefined) {
      return;
    }

    const commitMessage = commitMessageInput.trim() || placeholderMessage;

    try {
      isCurrentlySyncing = true;
      statusText = 'Manual sync in progress...';
      uiService.updateStatusBar('Syncing', 'Preparing files...');
      sidebarProvider.update(getSidebarState());

      await uiService.showProgress('Publishing to GitHub', async (progress) => {
        progress.report({ message: 'Preparing files...' });

        // Authenticate the push URL if needed
        if (currentUrl.startsWith('https://github.com/') && !currentUrl.includes('@')) {
          const authUrl = githubService.getAuthenticatedUrl(currentUrl, token);
          await gitService.addRemote(selectedFolder!, authUrl);
        }

        progress.report({ message: 'Creating commit...' });
        const branch = config.get<string>('defaultBranch') || 'main';

        progress.report({ message: 'Uploading to GitHub...' });
        await gitService.publishFiles(selectedFolder!, commitMessage, branch, connectedAccount || undefined);

        uiService.showInfo('Successfully published changes to GitHub!');
        statusText = `Successfully published at ${new Date().toLocaleTimeString()}`;
        uiService.updateStatusBar('Ready', 'Manual sync successful');
      });
    } catch (e: any) {
      statusText = `Publish error: ${e.message}`;
      uiService.updateStatusBar('Error', e.message);
      uiService.showError(`Publish failed: ${e.message}`);
    } finally {
      isCurrentlySyncing = false;
      await refreshState();
    }
  });

  // Command: Toggle Auto Sync
  const toggleAutoSyncCmd = vscode.commands.registerCommand('githubAutoPublisher.toggleAutoSync', async () => {
    const config = vscode.workspace.getConfiguration('githubAutoPublisher');
    const currentVal = config.get<boolean>('autoSync') || false;
    await config.update('autoSync', !currentVal, vscode.ConfigurationTarget.Global);
    await refreshState();
  });

  // Command: Focus Extension Dashboard
  const focusDashboardCmd = vscode.commands.registerCommand('githubAutoPublisher.focusDashboard', () => {
    vscode.commands.executeCommand('workbench.view.extension.github-auto-publisher-container');
  });

  context.subscriptions.push(
    connectAccountCmd,
    disconnectAccountCmd,
    viewConnectedAccountCmd,
    selectFolderCmd,
    connectRepositoryCmd,
    createRepositoryCmd,
    publishCmd,
    toggleAutoSyncCmd,
    focusDashboardCmd,
    uiService,
    watcherService
  );

  // 4. Watch for configuration changes
  const configWatcher = vscode.workspace.onDidChangeConfiguration(async (e) => {
    if (e.affectsConfiguration('githubAutoPublisher')) {
      await refreshState();
    }
  });
  context.subscriptions.push(configWatcher);

  // 5. Initial State Load
  await refreshState();
}

export function deactivate() {
  // Clean up takes place automatically via subscriptions
}

/**
 * Extracts a display-friendly repository name (owner/repo) from a remote URL.
 * Strips tokens and credentials for security.
 */
function getDisplayRepoName(url: string): string {
  try {
    let cleaned = url;
    if (url.includes('@')) {
      // Strip everything before @, preserving https://
      cleaned = 'https://' + url.substring(url.indexOf('@') + 1);
    }
    
    if (cleaned.endsWith('.git')) {
      cleaned = cleaned.substring(0, cleaned.length - 4);
    }

    // Extract last two parts (owner/repo)
    // Works with git@github.com:owner/repo and https://github.com/owner/repo
    cleaned = cleaned.replace(':', '/');
    const parts = cleaned.split('/');
    if (parts.length >= 2) {
      return parts.slice(-2).join('/');
    }
    return url;
  } catch (error) {
    return url;
  }
}
