import * as chokidar from 'chokidar';
import * as fs from 'fs';

export class WatcherService {
  private watcher: chokidar.FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private isWatchingActive: boolean = false;

  constructor(
    private onSyncNeeded: (changedFiles: string[]) => void,
    private onStatusUpdate: (detail: string) => void
  ) {}

  /**
   * Starts watching a directory. If already watching, stops the previous one first.
   */
  start(dirPath: string, debounceSeconds: number) {
    this.stop();

    if (!dirPath || !fs.existsSync(dirPath)) {
      this.onStatusUpdate('Folder path is invalid or does not exist.');
      return;
    }

    this.isWatchingActive = true;
    const changedFiles = new Set<string>();

    this.watcher = chokidar.watch(dirPath, {
      ignored: [
        '**/.git/**',
        '**/node_modules/**',
        '**/out/**',
        '**/.DS_Store',
        '**/Thumbs.db'
      ],
      persistent: true,
      ignoreInitial: true, // Do not trigger events for existing files on startup
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100
      }
    });

    const handleEvent = (filePath: string) => {
      changedFiles.add(filePath);
      this.onStatusUpdate(`Change detected: ${filePath}`);

      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(() => {
        if (this.isWatchingActive && changedFiles.size > 0) {
          const files = Array.from(changedFiles);
          changedFiles.clear();
          this.onSyncNeeded(files);
        }
      }, debounceSeconds * 1000);
    };

    this.watcher.on('add', handleEvent);
    this.watcher.on('change', handleEvent);
    this.watcher.on('unlink', handleEvent);

    this.watcher.on('error', (error) => {
      this.onStatusUpdate(`Watcher error: ${error.message}`);
    });
  }

  /**
   * Stops the active watcher.
   */
  stop() {
    this.isWatchingActive = false;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Returns whether file watching is currently active.
   */
  isWatching(): boolean {
    return this.isWatchingActive && this.watcher !== null;
  }

  /**
   * Dispose watcher by stopping it.
   */
  dispose() {
    this.stop();
  }
}
