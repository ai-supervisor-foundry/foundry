import * as path from 'path';

export class FileSystemMock {
  public files: Map<string, string> = new Map();
  private callHistory: { method: string; args: any[] }[] = [];

  constructor() {
    this.reset();
  }

  // --- Path Normalization ---
  private resolvePath(p: string): string {
    return path.resolve(p);
  }

  // --- Core Operations ---
  async readFile(filePath: string): Promise<string> {
    const resolved = this.resolvePath(filePath);
    this.recordCall('readFile', [filePath]);
    if (!this.files.has(resolved)) {
      const error: any = new Error(`ENOENT: no such file or directory, open '${resolved}'`);
      error.code = 'ENOENT';
      throw error;
    }
    return this.files.get(resolved)!;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const resolved = this.resolvePath(filePath);
    this.recordCall('writeFile', [filePath, content]);
    // Ensure parent directories exist (implied in a flat map, but logically important)
    this.files.set(resolved, content);
  }

  async exists(filePath: string): Promise<boolean> {
    const resolved = this.resolvePath(filePath);
    this.recordCall('exists', [filePath]);
    // Check if it matches a file exactly
    if (this.files.has(resolved)) return true;
    
    // Check if it's a directory (prefix match)
    // Add path separator to avoid partial matches (e.g. /tmp/file vs /tmp/file2)
    const dirPrefix = resolved + path.sep;
    for (const key of this.files.keys()) {
      if (key.startsWith(dirPrefix)) return true;
    }
    
    return false;
  }

  async unlink(filePath: string): Promise<void> {
    const resolved = this.resolvePath(filePath);
    this.recordCall('unlink', [filePath]);
    if (!this.files.delete(resolved)) {
      const error: any = new Error(`ENOENT: no such file or directory, unlink '${resolved}'`);
      error.code = 'ENOENT';
      throw error;
    }
  }

  // --- Directory Operations ---
  async mkdir(dirPath: string): Promise<void> {
    const resolved = this.resolvePath(dirPath);
    this.recordCall('mkdir', [dirPath]);
    // In this flat map implementation, explicit directories aren't strictly stored 
    // unless we use a sentinel or just rely on file paths. 
    // For compatibility with 'stat', we might want to store an empty entry or similar,
    // but usually 'mkdir' just needs to succeed.
  }

  async readdir(dirPath: string, options?: any): Promise<any[]> {
    const resolved = this.resolvePath(dirPath);
    this.recordCall('readdir', [dirPath, options]);

    const entriesMap = new Map<string, boolean>(); // name -> isFile (true if exact file, false if directory prefix)
    const dirPrefix = resolved + path.sep;

    for (const key of this.files.keys()) {
      if (key.startsWith(dirPrefix)) {
        const relative = key.slice(dirPrefix.length);
        const parts = relative.split(path.sep);
        if (parts.length > 0 && parts[0]) {
          const name = parts[0];
          // If parts.length === 1, it's a direct child file; otherwise it's a directory
          if (!entriesMap.has(name)) {
            entriesMap.set(name, parts.length === 1);
          } else if (parts.length > 1) {
            // If we already saw it as a file but now see subdirectory entries, mark as dir
            entriesMap.set(name, false);
          }
        }
      }
    }

    const withFileTypes = options?.withFileTypes === true;

    if (withFileTypes) {
      return Array.from(entriesMap.entries()).map(([name, isFile]) => ({
        name,
        isFile: () => isFile,
        isDirectory: () => !isFile,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isFIFO: () => false,
        isSocket: () => false,
        isSymbolicLink: () => false,
      }));
    }

    return Array.from(entriesMap.keys());
  }

  async stat(filePath: string): Promise<{ isFile: () => boolean; isDirectory: () => boolean }> {
    const resolved = this.resolvePath(filePath);
    this.recordCall('stat', [filePath]);

    // Exact match = File
    if (this.files.has(resolved)) {
      return {
        isFile: () => true,
        isDirectory: () => false,
      };
    }

    // Prefix match = Directory
    const dirPrefix = resolved + path.sep;
    for (const key of this.files.keys()) {
      if (key.startsWith(dirPrefix)) {
        return {
          isFile: () => false,
          isDirectory: () => true,
        };
      }
    }

    const error: any = new Error(`ENOENT: no such file or directory, stat '${resolved}'`);
    error.code = 'ENOENT';
    throw error;
  }

  // --- Sync Variants (simulated) ---
  readFileSync(filePath: string): string {
    const resolved = this.resolvePath(filePath);
    this.recordCall('readFileSync', [filePath]);
    if (!this.files.has(resolved)) {
      const error: any = new Error(`ENOENT: no such file or directory, open '${resolved}'`);
      error.code = 'ENOENT';
      throw error;
    }
    return this.files.get(resolved)!;
  }

  // --- Helpers ---
  reset(): void {
    this.files.clear();
    this.callHistory = [];
  }

  getCallHistory() {
    return [...this.callHistory];
  }

  private recordCall(method: string, args: any[]) {
    this.callHistory.push({ method, args });
  }
}