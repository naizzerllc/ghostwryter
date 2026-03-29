const LS_KEYS = {
  token: "ghostly_github_token",
  owner: "ghostly_github_owner",
} as const;

const REPO = "ghostly-data";
const LS_FILE_PREFIX = "ghostly_file_";

export interface GitHubStorageResult {
  saved: boolean;
  storage: "github" | "local";
  error?: string;
}

export interface GitHubConnectionResult {
  connected: boolean;
  error?: string;
}

export interface GitHubFileEntry {
  name: string;
  path: string;
  type: "file" | "dir";
}

class GitHubStorage {
  connected = false;
  private token = "";
  private owner = "";

  init(): void {
    this.token = localStorage.getItem(LS_KEYS.token) || "";
    this.owner = localStorage.getItem(LS_KEYS.owner) || "";
    this.connected = !!(this.token && this.owner);
  }

  async testConnection(): Promise<GitHubConnectionResult> {
    this.init();
    if (!this.token || !this.owner) {
      return { connected: false, error: "Token and owner must be configured" };
    }
    try {
      const res = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(this.owner)}/${REPO}`,
        { headers: this.headers() }
      );
      if (res.ok) {
        this.connected = true;
        this.emitStatus(true);
        return { connected: true };
      }
      this.handleDisconnect();
      return { connected: false, error: `HTTP ${res.status}: ${res.statusText}` };
    } catch (err) {
      this.handleDisconnect();
      return {
        connected: false,
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  }

  async saveFile(path: string, content: string): Promise<GitHubStorageResult> {
    this.init();
    if (!this.connected) {
      localStorage.setItem(`${LS_FILE_PREFIX}${path}`, content);
      return { saved: true, storage: "local" };
    }

    try {
      const filePath = `projects/${path}`;
      // Get existing SHA for updates
      let sha: string | undefined;
      try {
        const existing = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(this.owner)}/${REPO}/contents/${filePath}`,
          { headers: this.headers() }
        );
        if (existing.ok) {
          const data = await existing.json();
          sha = data.sha;
        }
      } catch {
        // File doesn't exist yet — that's fine
      }

      const body: Record<string, string> = {
        message: `ghostly: update ${path}`,
        content: btoa(unescape(encodeURIComponent(content))),
      };
      if (sha) body.sha = sha;

      const res = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(this.owner)}/${REPO}/contents/${filePath}`,
        {
          method: "PUT",
          headers: this.headers(),
          body: JSON.stringify(body),
        }
      );

      if (res.ok) {
        return { saved: true, storage: "github" };
      }

      // Fallback to localStorage on failure
      this.handleDisconnect();
      localStorage.setItem(`${LS_FILE_PREFIX}${path}`, content);
      return { saved: true, storage: "local", error: `GitHub failed (${res.status}), saved locally` };
    } catch (err) {
      this.handleDisconnect();
      localStorage.setItem(`${LS_FILE_PREFIX}${path}`, content);
      return {
        saved: true,
        storage: "local",
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  }

  async loadFile(path: string): Promise<string | null> {
    this.init();
    if (this.connected) {
      try {
        const filePath = `projects/${path}`;
        const res = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(this.owner)}/${REPO}/contents/${filePath}`,
          { headers: this.headers() }
        );
        if (res.ok) {
          const data = await res.json();
          return decodeURIComponent(escape(atob(data.content.replace(/\n/g, ""))));
        }
        if (res.status !== 404) {
          this.handleDisconnect();
        }
      } catch {
        this.handleDisconnect();
      }
    }

    // Fallback to localStorage
    return localStorage.getItem(`${LS_FILE_PREFIX}${path}`);
  }

  async listFiles(prefix: string): Promise<GitHubFileEntry[]> {
    this.init();
    if (!this.connected) return [];

    try {
      const filePath = `projects/${prefix}`;
      const res = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(this.owner)}/${REPO}/contents/${filePath}`,
        { headers: this.headers() }
      );
      if (!res.ok) {
        if (res.status !== 404) this.handleDisconnect();
        return [];
      }
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data.map((entry: { name: string; path: string; type: string }) => ({
        name: entry.name,
        path: entry.path,
        type: entry.type === "dir" ? "dir" as const : "file" as const,
      }));
    } catch {
      this.handleDisconnect();
      return [];
    }
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  private handleDisconnect(): void {
    this.connected = false;
    this.emitStatus(false);
  }

  private emitStatus(connected: boolean): void {
    window.dispatchEvent(
      new CustomEvent("ghostly:github-status", { detail: { connected } })
    );
  }
}

export const githubStorage = new GitHubStorage();
