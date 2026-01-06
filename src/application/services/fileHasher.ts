import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Compute SHA-256 hash of a single file
 */
export async function hashFile(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (error) {
    // If file doesn't exist or can't be read, return empty hash or specific marker
    // For validation purposes, treating missing file as empty/null is often safer than crashing
    return '';
  }
}

/**
 * Compute combined SHA-256 hash of multiple files
 * Sorts file paths to ensure deterministic output order
 */
export async function hashFiles(filePaths: string[]): Promise<string> {
  const sortedPaths = [...filePaths].sort();
  const hasher = crypto.createHash('sha256');
  
  for (const filePath of sortedPaths) {
    const fileHash = await hashFile(filePath);
    // Update with filename and hash to capture file existence/rename changes
    hasher.update(path.basename(filePath)); 
    hasher.update(fileHash);
  }
  
  return hasher.digest('hex');
}
