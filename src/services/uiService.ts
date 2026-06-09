import * as vscode from 'vscode';

export class UiService implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      10
    );
    this.statusBarItem.command = 'githubAutoPublisher.focusDashboard';
    this.statusBarItem.show();
    this.updateStatusBar('Disconnected', 'No GitHub account connected');
  }

  /**
   * Updates the text, icon, and tooltip of the status bar item.
   */
  updateStatusBar(state: 'Ready' | 'Syncing' | 'Error' | 'Disconnected', detail?: string) {
    let text = 'GitHub Sync: ';
    let tooltip = 'GitHub Auto Publisher';
    let color: vscode.ThemeColor | undefined;

    switch (state) {
      case 'Ready':
        text += '$(check) Ready';
        tooltip += ' - Connected & Idle';
        break;
      case 'Syncing':
        text += '$(sync~spin) Syncing...';
        tooltip += ' - Syncing changes...';
        break;
      case 'Error':
        text += '$(alert) Error';
        tooltip += ` - Error occurred`;
        // Use standard error colors if available in VS Code version
        color = new vscode.ThemeColor('statusBarItem.errorBackground');
        break;
      case 'Disconnected':
        text += '$(circle-slash) Disconnected';
        tooltip += ' - No GitHub account connected';
        break;
    }

    if (detail) {
      tooltip += `\nDetail: ${detail}`;
    }

    this.statusBarItem.text = text;
    this.statusBarItem.tooltip = tooltip;
    
    // Set status bar colors for errors
    if (state === 'Error') {
      this.statusBarItem.backgroundColor = color;
    } else {
      this.statusBarItem.backgroundColor = undefined;
    }
  }

  /**
   * Shows a friendly information toast.
   */
  showInfo(message: string) {
    vscode.window.showInformationMessage(`GitHub Sync: ${message}`);
  }

  /**
   * Shows a friendly error toast with optional actions.
   */
  async showError(message: string, ...actions: string[]): Promise<string | undefined> {
    return await vscode.window.showErrorMessage(`GitHub Sync: ${message}`, ...actions);
  }

  /**
   * Runs an operation inside a standard VS Code Progress notification.
   */
  async showProgress<T>(
    title: string,
    action: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>
  ): Promise<T> {
    return await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `GitHub Auto Publisher: ${title}`,
      cancellable: false
    }, async (progress) => {
      return await action(progress);
    });
  }

  /**
   * Clean up the status bar item.
   */
  dispose() {
    this.statusBarItem.dispose();
  }
}
