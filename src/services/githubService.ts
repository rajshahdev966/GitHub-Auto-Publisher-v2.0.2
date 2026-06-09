export interface GitHubRepo {
  name: string;
  full_name: string;
  clone_url: string;
  private: boolean;
}

export class GitHubService {
  private userAgent = 'vscode-github-auto-publisher';

  /**
   * Validates a GitHub Personal Access Token (PAT) by fetching user info.
   * Returns the username if valid.
   */
  async validateToken(token: string): Promise<string> {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': this.userAgent
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.message || `HTTP ${response.status}`;
        throw new Error(`Authentication failed: ${message}`);
      }

      const data = await response.json() as { login: string };
      if (!data || !data.login) {
        throw new Error('Could not retrieve username from GitHub response.');
      }
      return data.login;
    } catch (error: any) {
      throw new Error(error.message || 'Network error connecting to GitHub.');
    }
  }

  /**
   * Creates a new GitHub repository for the authenticated user.
   * Returns the clone URL of the created repository.
   */
  async createRepository(token: string, name: string, isPrivate: boolean): Promise<string> {
    try {
      const response = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': this.userAgent
        },
        body: JSON.stringify({
          name: name,
          private: isPrivate,
          auto_init: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.message || `HTTP ${response.status}`;
        throw new Error(`Failed to create repository: ${message}`);
      }

      const data = await response.json() as { clone_url: string };
      if (!data || !data.clone_url) {
        throw new Error('GitHub API did not return a clone URL.');
      }
      return data.clone_url;
    } catch (error: any) {
      throw new Error(error.message || 'Error communicating with GitHub.');
    }
  }

  /**
   * Retrieves all repositories owned by the authenticated user.
   */
  async getUserRepositories(token: string): Promise<GitHubRepo[]> {
    try {
      const response = await fetch('https://api.github.com/user/repos?per_page=100&affiliation=owner&sort=updated', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': this.userAgent
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.message || `HTTP ${response.status}`;
        throw new Error(`Failed to list repositories: ${message}`);
      }

      const data = await response.json() as any[];
      return data.map(repo => ({
        name: repo.name,
        full_name: repo.full_name,
        clone_url: repo.clone_url,
        private: repo.private
      }));
    } catch (error: any) {
      throw new Error(error.message || 'Error fetching repositories from GitHub.');
    }
  }

  /**
   * Converts a standard GitHub HTTPS clone URL into an authenticated URL
   * that embeds the PAT so Git operations don't prompt for credentials.
   */
  getAuthenticatedUrl(cloneUrl: string, token: string): string {
    // Expected cloneUrl format: https://github.com/owner/repo.git
    if (cloneUrl.startsWith('https://github.com/')) {
      const urlPart = cloneUrl.replace('https://github.com/', '');
      return `https://x-access-token:${token}@github.com/${urlPart}`;
    }
    return cloneUrl;
  }
}
