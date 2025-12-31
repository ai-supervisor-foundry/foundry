import * as fs from 'fs/promises';
import * as path from 'path';
import { log as logShared, logVerbose } from '../../../adapters/logging/logger';

function log(message: string, ...args: unknown[]): void {
  logShared('FileSystemExecutor', message, ...args);
}

/**
 * Recursively list files in a directory
 * Limits depth and total file count to prevent huge context
 */
export async function getFileList(dir: string, maxFiles = 100, depth = 0, maxDepth = 5): Promise<string[]> {
    const fileList: string[] = [];
    if (depth > maxDepth) return fileList;
  
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (fileList.length >= maxFiles) break;
        
        const fullPath = path.join(dir, entry.name);
        
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') {
          continue; // Skip hidden files and common build/dependency dirs
        }
  
        if (entry.isDirectory()) {
          const subFiles = await getFileList(fullPath, maxFiles - fileList.length, depth + 1, maxDepth);
          fileList.push(...subFiles);
        } else {
          fileList.push(fullPath);
        }
      }
    } catch (error) {
      log(`Error listing files in ${dir}: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return fileList;
  }