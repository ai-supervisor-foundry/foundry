/**
 * Deterministic Validation - Fast file-based checks before helper agent
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import * as semver from 'semver';

// Safety Limits
const MAX_FILES_SCANNED = parseInt(process.env.HELPER_DETERMINISTIC_MAX_FILES || '2000', 10);
const MAX_TOTAL_BYTES_READ = parseInt(process.env.HELPER_DETERMINISTIC_MAX_BYTES || '10485760', 10); // 10MB
const MAX_FILE_SIZE = 512 * 1024; // 512KB

// Safe Extensions for Content Scanning
const SAFE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html', '.txt', '.yml', '.yaml']);

// Catastrophic Backtracking Patterns
const CATASTROPHIC_PATTERNS = [
  /\(\.\*\)\+/,     // (.*)+
  /\(\.\*\)\*/,     // (.*)*
  /\(\.\*\)\{2,\}/, // (.*){2,}
  /\([a-zA-Z0-9]\+\)\+/, // (a+)+
];

function isCatastrophic(pattern: string): boolean {
  return CATASTROPHIC_PATTERNS.some(regex => regex.test(pattern));
}

export interface DeterministicValidationResult {
  canValidate: boolean;  // Can we determine validation without helper?
  valid?: boolean;       // If canValidate=true, is validation passing?
  reason?: string;       // Explanation
  confidence: 'high' | 'medium' | 'low';
}

export interface CriterionCheck {
  type: 'file_exists' | 'file_not_exists' | 'json_contains' | 'json_not_contains' | 
        'file_count' | 'directory_exists' | 'grep_found' | 'grep_not_found';
  path?: string;         // File/directory path
  pattern?: string;      // JSON key, grep pattern, or glob pattern
  value?: any;           // Expected value (for json_contains)
  count?: { min?: number; max?: number };  // For file_count
  negate?: boolean;      // Invert result (mostly for internal use, explicit types preferred)
}

export interface CriterionMapping {
  keywords: RegExp[];    // Patterns to match in criterion text
  checks: CriterionCheck[];
  confidence: 'high' | 'medium'; // Required confidence level for this rule
}

// Context to track resource usage across checks
class ValidationContext {
  filesRead = 0;
  bytesRead = 0;

  checkLimits() {
    if (this.filesRead >= MAX_FILES_SCANNED) throw new Error('MAX_FILES_SCANNED exceeded');
    if (this.bytesRead >= MAX_TOTAL_BYTES_READ) throw new Error('MAX_TOTAL_BYTES_READ exceeded');
  }

  increment(bytes: number) {
    this.filesRead++;
    this.bytesRead += bytes;
    this.checkLimits();
  }
}

/**
 * Attempt to validate criteria deterministically before invoking helper agent
 */
export async function attemptDeterministicValidation(
  failedCriteria: string[],
  agentResponse: string,
  sandboxCwd: string,
  rules: Record<string, CriterionMapping>
): Promise<DeterministicValidationResult> {
  
  const results: { criterion: string; canValidate: boolean; valid?: boolean; confidence: string }[] = [];
  const context = new ValidationContext();
  
  try {
    for (const criterion of failedCriteria) {
      // Try to map criterion to known check patterns
      const mapping = findCriterionMapping(criterion, rules);
      
      if (!mapping) {
        // Cannot validate this criterion deterministically
        results.push({ criterion, canValidate: false, confidence: 'low' });
        continue;
      }
      
      // Execute deterministic checks
      const checkResults = await executeChecks(mapping.checks, sandboxCwd, context);
      
      results.push({
        criterion,
        canValidate: true,
        valid: checkResults.allPassed,
        confidence: mapping.confidence // Use the rule's declared confidence
      });
    }
  } catch (error) {
    // If limits exceeded or other error, fallback safely
    return {
      canValidate: false,
      confidence: 'low',
      reason: `Deterministic validation aborted: ${error instanceof Error ? error.message : String(error)}`
    };
  }
  
  // Determine overall result
  const canValidateAll = results.every(r => r.canValidate);
  
  if (!canValidateAll) {
    return {
      canValidate: false,
      confidence: 'low',
      reason: 'Some criteria require helper agent for verification'
    };
  }
  
  const allValid = results.every(r => r.valid === true);
  const highConfidence = results.every(r => r.confidence === 'high');
  
  return {
    canValidate: true,
    valid: allValid,
    confidence: highConfidence ? 'high' : 'medium',
    reason: allValid 
      ? `All ${failedCriteria.length} criteria verified deterministically` 
      : `${results.filter(r => !r.valid).length} criteria still failing after deterministic checks`
  };
}

function findCriterionMapping(criterion: string, rules: Record<string, CriterionMapping>): CriterionMapping | null {
  for (const mapping of Object.values(rules)) {
    if (mapping.keywords.some(regex => regex.test(criterion))) {
      return mapping;
    }
  }
  return null;
}

async function executeChecks(
  checks: CriterionCheck[], 
  sandboxCwd: string,
  context: ValidationContext
): Promise<{ allPassed: boolean; confidence: 'high' | 'medium' | 'low' }> {
  for (const check of checks) {
    const passed = await executeCheck(check, sandboxCwd, context);
    if (!passed) {
      return { allPassed: false, confidence: 'high' };
    }
  }
  
  return { allPassed: true, confidence: 'high' };
}

async function executeCheck(check: CriterionCheck, sandboxCwd: string, context: ValidationContext): Promise<boolean> {
  const fullPath = path.join(sandboxCwd, check.path || '');
  
  switch (check.type) {
    case 'file_exists':
      return await fileExists(fullPath);
    
    case 'file_not_exists':
      return !(await fileExists(fullPath));
    
    case 'json_contains':
      return await jsonContains(fullPath, check.pattern!, check.value, context);

    case 'json_not_contains':
        return !(await jsonContains(fullPath, check.pattern!, check.value, context));
    
    case 'directory_exists':
        if (check.negate) return !(await directoryExists(fullPath));
        return await directoryExists(fullPath);

    case 'file_count':
         return await checkFileCount(sandboxCwd, check.pattern!, check.count, context);

    case 'grep_found':
        return await grepContent(fullPath, check.pattern!, context);

    case 'grep_not_found':
        return !(await grepContent(fullPath, check.pattern!, context));
    
    default:
      return false;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function jsonContains(filePath: string, key: string, value: any, context: ValidationContext): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    if (stat.size > MAX_FILE_SIZE) return false;
    
    context.increment(stat.size);
    const content = await fs.readFile(filePath, 'utf8');
    const json = JSON.parse(content);
    
    // Navigate nested keys (e.g., "scripts.build")
    const keys = key.split('.');
    let current = json;
    for (const k of keys) {
      if (current === undefined || current === null || !(k in current)) return false;
      current = current[k];
    }
    
    if (value !== undefined) {
       // Semver check support
       if (typeof value === 'string' && typeof current === 'string' && (value.startsWith('~') || value.startsWith('^') || value.includes('>'))) {
           try {
             return semver.satisfies(current, value);
           } catch {
             // If semver parsing fails, fall back to exact match
             return current === value;
           }
       }
      return current === value;
    }
    
    return true;  // Key exists
  } catch {
    return false;
  }
}

async function checkFileCount(cwd: string, pattern: string, count: { min?: number; max?: number } | undefined, context: ValidationContext): Promise<boolean> {
    try {
        // Use glob with limits if possible, but standard glob doesn't limit count well without scanning
        // We'll trust glob for count but be careful with patterns
        const files = await glob(pattern, { cwd, nodir: true });
        
        // Count limits are just metadata ops, no heavy read, but let's count glob overhead?
        // We won't count 'bytesRead' for file listing, but we should respect file scan limits if we were reading them.
        
        const numFiles = files.length;
        if (count?.min !== undefined && numFiles < count.min) return false;
        if (count?.max !== undefined && numFiles > count.max) return false;
        return true;
    } catch {
        return false;
    }
}

async function grepContent(filePath: string, pattern: string, context: ValidationContext): Promise<boolean> {
    try {
        if (isCatastrophic(pattern)) {
            // Log warning? For now just fail safely
            return false;
        }

        let regex: RegExp;
        try {
            // Safe regex compilation
            regex = new RegExp(pattern, 'i');
        } catch {
            return false; // Invalid regex
        }

        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
             // Recursive grep with limits
             const files = await glob('**/*', { cwd: filePath, nodir: true });
             
             for (const file of files) {
                 // Extension check
                 if (!SAFE_EXTENSIONS.has(path.extname(file))) continue;

                 const fullSubPath = path.join(filePath, file);
                 const subStat = await fs.stat(fullSubPath);
                 
                 if (subStat.size > MAX_FILE_SIZE) continue;
                 
                 context.increment(subStat.size);
                 const content = await fs.readFile(fullSubPath, 'utf8');
                 if (regex.test(content)) return true;
             }
             return false;
        } else {
            if (stat.size > MAX_FILE_SIZE) return false;
            
            context.increment(stat.size);
            const content = await fs.readFile(filePath, 'utf8');
            return regex.test(content);
        }
    } catch {
        return false;
    }
}
