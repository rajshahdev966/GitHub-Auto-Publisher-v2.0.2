import { simpleGit, SimpleGit } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';

export class GitService {
  /**
   * Checks if Git is installed and available in the system PATH.
   */
  async isGitInstalled(): Promise<boolean> {
    try {
      const git: SimpleGit = simpleGit();
      await git.version();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Checks if the target directory is a Git repository.
   */
  async isGitRepository(dirPath: string): Promise<boolean> {
    try {
      if (!fs.existsSync(dirPath)) {
        return false;
      }
      const gitPath = path.join(dirPath, '.git');
      return fs.existsSync(gitPath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Initializes a Git repository in the target directory.
   */
  async initRepository(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      throw new Error(`Directory ${dirPath} does not exist.`);
    }
    const git: SimpleGit = simpleGit(dirPath);
    await git.init();
  }

  /**
   * Creates a default .gitignore file if one does not exist.
   */
  async createGitIgnore(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      return;
    }
    const gitignorePath = path.join(dirPath, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      const content = [
        "node_modules/",
        "out/",
        ".vscode-test/",
        "*.vsix",
        ".DS_Store",
        "*.log",
        ".env"
      ].join("\n") + "\n";
      await fs.promises.writeFile(gitignorePath, content, 'utf8');
    }
  }

  /**
   * Adds or updates the remote 'origin' URL.
   */
  async addRemote(dirPath: string, url: string): Promise<void> {
    const git: SimpleGit = simpleGit(dirPath);
    const remotes = await git.getRemotes();
    const hasOrigin = remotes.some(r => r.name === 'origin');
    
    if (hasOrigin) {
      await git.removeRemote('origin');
    }
    await git.addRemote('origin', url);
  }

  /**
   * Gets the 'origin' remote URL if it exists.
   */
  async getRemoteUrl(dirPath: string): Promise<string | null> {
    try {
      if (!fs.existsSync(dirPath)) {
        return null;
      }
      const isRepo = await this.isGitRepository(dirPath);
      if (!isRepo) {
        return null;
      }
      const git: SimpleGit = simpleGit(dirPath);
      const remotes = await git.getRemotes(true);
      const origin = remotes.find(r => r.name === 'origin');
      
      if (origin && origin.refs && origin.refs.push) {
        return origin.refs.push;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Performs git add, git commit, and git push.
   */
  async publishFiles(dirPath: string, commitMessage: string, branch: string, authorName?: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      throw new Error(`Directory ${dirPath} does not exist.`);
    }
    const isRepo = await this.isGitRepository(dirPath);
    if (!isRepo) {
      throw new Error(`Directory ${dirPath} is not a Git repository.`);
    }

    const git: SimpleGit = simpleGit(dirPath);

    // Add all files
    await git.add('.');

    // Check if there are changes to commit
    const freshStatus = await git.status();
    const hasChanges = freshStatus.files.length > 0;
    
    if (hasChanges) {
      // Ensure the local git user configuration exists (user.name and user.email)
      // to prevent commit errors when Git identity is not set globally.
      let hasEmail = false;
      let hasName = false;
      try {
        const emailConfig = await git.getConfig('user.email');
        hasEmail = !!emailConfig.value;
      } catch {}
      try {
        const nameConfig = await git.getConfig('user.name');
        hasName = !!nameConfig.value;
      } catch {}

      if (!hasEmail) {
        const fallbackEmail = authorName ? `${authorName}@users.noreply.github.com` : 'auto-publisher@users.noreply.github.com';
        await git.addConfig('user.email', fallbackEmail);
      }
      if (!hasName) {
        const fallbackName = authorName || 'GitHub Auto Publisher';
        await git.addConfig('user.name', fallbackName);
      }

      await git.commit(commitMessage);
    }

    // Ensure the local branch matches the default/target branch name (e.g. main/master).
    // We do this AFTER the first commit is made, because HEAD must point to a valid object
    // for Git to allow branch renames or checkouts.
    const status = await git.status();
    const currentBranch = status.current;
    
    if (currentBranch && currentBranch !== branch) {
      try {
        // Try renaming the current branch to default branch (e.g. main)
        await git.branch(['-M', branch]);
      } catch (renameError) {
        // Fallback: Try checkout
        try {
          await git.checkout(branch);
        } catch (checkoutError) {
          // Create new local branch
          await git.checkoutLocalBranch(branch);
        }
      }
    }

    // Push to origin
    // Use --set-upstream to configure remote tracking branch if pushing for the first time
    await git.push('origin', branch, { '--set-upstream': null });
  }
}
