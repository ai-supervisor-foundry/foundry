// Global test setup for Foundry
import { fsRegistry } from './helpers/fs-registry';
import * as path from 'path';

// Set global timeout for functional tests
jest.setTimeout(30000);

// Enable Goal Completion Check for tests
process.env.IS_ENABLED_GOAL_COMPLETION_CHECK = 'true';

// --- Mock fs module ---
jest.mock('fs', () => {
  const originalFs = jest.requireActual('fs');
  
  return {
    ...originalFs, // Preserve constants and other utilities
    
    // --- Sync Methods ---
    existsSync: (path: string) => {
      if (fsRegistry.currentMock) {
        return (fsRegistry.currentMock as any).files.has(require('path').resolve(path));
      }
      return originalFs.existsSync(path);
    },

    readFileSync: (path: string, options: any) => {
      if (fsRegistry.currentMock) {
        return (fsRegistry.currentMock as any).readFileSync(path);
      }
      return originalFs.readFileSync(path, options);
    },

    readdirSync: (path: string, options: any) => {
      if (fsRegistry.currentMock) {
        const resolved = require('path').resolve(path);
        const filesMap = (fsRegistry.currentMock as any).files;
        const entries = new Set<string>();
        const dirPrefix = resolved + require('path').sep;
        
        for (const key of filesMap.keys()) {
          if (key.startsWith(dirPrefix)) {
            const relative = key.slice(dirPrefix.length);
            const parts = relative.split(require('path').sep);
            if (parts.length > 0 && parts[0]) {
              entries.add(parts[0]);
            }
          }
        }
        return Array.from(entries);
      }
      return originalFs.readdirSync(path, options);
    },

    statSync: (path: string) => {
      if (fsRegistry.currentMock) {
        const resolved = require('path').resolve(path);
        const filesMap = (fsRegistry.currentMock as any).files;
        
        if (filesMap.has(resolved)) {
          return {
            isFile: () => true,
            isDirectory: () => false,
            size: filesMap.get(resolved).length
          };
        }
        
        const dirPrefix = resolved + require('path').sep;
        for (const key of filesMap.keys()) {
          if (key.startsWith(dirPrefix)) {
            return {
              isFile: () => false,
              isDirectory: () => true,
              size: 0
            };
          }
        }
        const err: any = new Error(`ENOENT: no such file or directory, stat '${resolved}'`);
        err.code = 'ENOENT';
        throw err;
      }
      return originalFs.statSync(path);
    },

    mkdirSync: (path: string, options: any) => {
      if (fsRegistry.currentMock) {
        return; // Implicit
      }
      return originalFs.mkdirSync(path, options);
    },

    // --- Async Methods (Callback-based) ---
    readFile: (path: string, arg2: any, arg3: any) => {
      if (fsRegistry.currentMock) {
        const cb = typeof arg2 === 'function' ? arg2 : arg3;
        fsRegistry.currentMock.readFile(path)
          .then((data: any) => cb(null, data))
          .catch((err: any) => cb(err));
        return;
      }
      return originalFs.readFile(path, arg2, arg3);
    },
    
    appendFile: (path: string, data: string, arg3: any, arg4: any) => {
      if (fsRegistry.currentMock) {
        const cb = typeof arg3 === 'function' ? arg3 : arg4;
        const resolved = require('path').resolve(path);
        const filesMap = (fsRegistry.currentMock as any).files;
        const current = filesMap.get(resolved) || '';
        filesMap.set(resolved, current + data);
        if (cb) cb(null);
        return;
      }
      return originalFs.appendFile(path, data, arg3, arg4);
    },

    stat: (path: string, callback: any) => {
      if (fsRegistry.currentMock) {
        fsRegistry.currentMock.stat(path)
          .then((stats: any) => callback(null, stats))
          .catch((err: any) => callback(err));
        return;
      }
      return originalFs.stat(path, callback);
    },

    readdir: (path: string, options: any, callback: any) => {
      if (fsRegistry.currentMock) {
        const cb = typeof options === 'function' ? options : callback;
        fsRegistry.currentMock.readdir(path)
          .then((files: any) => cb(null, files))
          .catch((err: any) => cb(err));
        return;
      }
      return originalFs.readdir(path, options, callback);
    }
  };
});

// --- Mock fs/promises module ---
jest.mock('fs/promises', () => {
  const originalFsPromises = jest.requireActual('fs/promises');
  return {
    ...originalFsPromises,
    readFile: async (path: string, options: any) => {
      if (fsRegistry.currentMock) {
        return await fsRegistry.currentMock.readFile(path);
      }
      return originalFsPromises.readFile(path, options);
    },
    writeFile: async (path: string, data: string, options: any) => {
      if (fsRegistry.currentMock) {
        return await fsRegistry.currentMock.writeFile(path, data);
      }
      return originalFsPromises.writeFile(path, data, options);
    },
    appendFile: async (path: string, data: string, options: any) => {
      if (fsRegistry.currentMock) {
        const resolved = require('path').resolve(path);
        const filesMap = (fsRegistry.currentMock as any).files;
        const current = filesMap.get(resolved) || '';
        filesMap.set(resolved, current + data);
        return;
      }
      return originalFsPromises.appendFile(path, data, options);
    },
    access: async (path: string) => {
      if (fsRegistry.currentMock) {
        const exists = await fsRegistry.currentMock.exists(path);
        if (!exists) {
          const err: any = new Error(`ENOENT: no such file or directory, access '${path}'`);
          err.code = 'ENOENT';
          throw err;
        }
        return;
      }
      return originalFsPromises.access(path);
    },
    mkdir: async (path: string, options: any) => {
      if (fsRegistry.currentMock) {
        return await fsRegistry.currentMock.mkdir(path);
      }
      return originalFsPromises.mkdir(path, options);
    },
    readdir: async (path: string, options: any) => {
      if (fsRegistry.currentMock) {
        return await fsRegistry.currentMock.readdir(path);
      }
      return originalFsPromises.readdir(path, options);
    },
    stat: async (path: string) => {
      if (fsRegistry.currentMock) {
        return await fsRegistry.currentMock.stat(path);
      }
      return originalFsPromises.stat(path);
    },
    unlink: async (path: string) => {
      if (fsRegistry.currentMock) {
        return await fsRegistry.currentMock.unlink(path);
      }
      return originalFsPromises.unlink(path);
    }
  };
});