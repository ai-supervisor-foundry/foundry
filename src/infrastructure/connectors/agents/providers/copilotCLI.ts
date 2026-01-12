import { exec, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import { ProviderResult } from '../../../../domain/executors/haltDetection';
import { logVerbose } from '../../../adapters/logging/logger';

const execAsync = promisify(exec);
const SESSION_DIR = path.join(os.homedir(), '.copilot', 'session-state');

function log(message: string, ...args: unknown[]): void {
  logVerbose('CopilotCLI', message, { args });
}

export interface CopilotOptions {
  model?: string;
  agent?: string;
  sessionId?: string;
}

export interface CopilotResult {
  output: string;
  sessionId?: string;
  usage?: {
    tokens?: number; // Approximate
    durationSeconds?: number;
  };
}

export class CopilotCLI {
  private debug: boolean = false;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  /**
   * Dispatches a prompt to GitHub Copilot CLI.
   * Resumes a session if sessionId is provided, otherwise starts a new one.
   */
  async dispatch(prompt: string, sessionId?: string, options: CopilotOptions = {}): Promise<CopilotResult> {
    const cliPath = process.env.COPILOT_CLI_PATH || 'npx';
    const isNpx = cliPath === 'npx';
    
    // Construct args array for spawn
    const args: string[] = [];
    
    if (isNpx) {
      args.push('@github/copilot');
    }

    if (sessionId) {
      args.push('--resume', sessionId);
    } else {
      if (options.agent) {
        args.push('--agent', options.agent);
      }
      if (options.model) {
        args.push('--model', options.model);
      }
    }

    // Add required flags
    args.push('--allow-all-tools', '--silent');

    // Add prompt (no escaping needed for spawn)
    args.push('--prompt', prompt);

    if (this.debug) {
      log(`Spawning: ${cliPath} ${args.join(' ')}`);
    }

    return new Promise((resolve, reject) => {
      const child = spawn(cliPath, args, {
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'] // Capture stdout/stderr
      });

      log(`Spawned process with PID: ${child.pid}`);
      child.stdin.end();

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        reject(error);
      });

      child.on('close', async (code) => {
        if (code !== 0) {
          // Check for tool approval request in output
          if (stdout.includes('Allow Copilot to use')) {
            reject(new Error('TOOL_APPROVAL_REQUIRED: Copilot requested tool approval which cannot be handled non-interactively.'));
            return;
          }
          
          // Reconstruct error
          const error = new Error(`Copilot CLI failed with exit code ${code}`);
          (error as any).code = code;
          (error as any).stdout = stdout;
          (error as any).stderr = stderr;
          reject(error);
          return;
        }

        // Success path
        const output = stdout.trim();
        
        let activeSessionId = sessionId;
        if (!activeSessionId) {
          activeSessionId = await this.findMostRecentSessionId();
        }

        const usage = this.parseUsage(output);

        resolve({
          output,
          sessionId: activeSessionId,
          usage
        });
      });
    });
  }

  /**
   * Scans ~/.copilot/session-state/ for the most recently modified .jsonl file
   * to identify the session ID of the just-executed command.
   */
  private async findMostRecentSessionId(): Promise<string | undefined> {
    if (!fs.existsSync(SESSION_DIR)) return undefined;

    try {
      const files = await fs.promises.readdir(SESSION_DIR);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

      if (jsonlFiles.length === 0) return undefined;

      // Sort by mtime descending
      const fileStats = await Promise.all(jsonlFiles.map(async f => {
        const filePath = path.join(SESSION_DIR, f);
        const stats = await fs.promises.stat(filePath);
        return { file: f, mtime: stats.mtime };
      }));

      fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      const mostRecent = fileStats[0];
      
      // Try to parse ID from content first, else filename
      const filePath = path.join(SESSION_DIR, mostRecent.file);
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const firstLine = content.split('\n')[0];
      
      if (firstLine) {
        try {
          const json = JSON.parse(firstLine);
          if (json.data && json.data.sessionId) {
            return json.data.sessionId;
          }
        } catch (e) {
          // Ignore parse error
        }
      }

      // Fallback to filename
      return path.basename(mostRecent.file, '.jsonl');

    } catch (error) {
      console.error('[CopilotCLI] Error finding session ID:', error);
      return undefined;
    }
  }

  private parseUsage(output: string): { tokens?: number, durationSeconds?: number } {
    const durationMatch = output.match(/Total duration \(wall\):\s+(\d+)s/);
    const durationSeconds = durationMatch ? parseInt(durationMatch[1], 10) : undefined;
    
    return {
      durationSeconds
    };
  }

  async listSessions(): Promise<Array<{ snippet: string, timeRelative: string, sessionId: string }>> {
     if (!fs.existsSync(SESSION_DIR)) return [];
     
     try {
       const files = await fs.promises.readdir(SESSION_DIR);
       const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
       
       const sessions: Array<{ snippet: string, timeRelative: string, sessionId: string }> = [];
       
       for (const file of jsonlFiles) {
         try {
           const filePath = path.join(SESSION_DIR, file);
           const stats = await fs.promises.stat(filePath);
           const content = await fs.promises.readFile(filePath, 'utf-8');
           const firstLine = content.split('\n')[0];
           
           if (firstLine) {
             const json = JSON.parse(firstLine);
             // Copilot doesn't give us a clear "snippet" or "timeRelative" easily without parsing more
             // But we can use mtime for timeRelative logic approximation
             
             // Try to find the first user message for the snippet
             const userMsgLine = content.split('\n').find(l => l.includes('user.message'));
             let snippet = 'Unknown session';
             if (userMsgLine) {
                try {
                    const userMsg = JSON.parse(userMsgLine);
                    if (userMsg.data && userMsg.data.content) {
                        snippet = userMsg.data.content.substring(0, 50);
                    }
                } catch (e) {}
             }

             if (json.data && json.data.sessionId) {
               sessions.push({
                 sessionId: json.data.sessionId,
                 timeRelative: stats.mtime.toISOString(), // Standard ISO for now
                 snippet: snippet
               });
             }
           }
         } catch (e) {
           // Ignore unreadable files
         }
       }
       
       // Sort by time descending
       return sessions.sort((a, b) => new Date(b.timeRelative).getTime() - new Date(a.timeRelative).getTime());
     } catch (error) {
       return [];
     }
  }
}

export const copilotCLI = new CopilotCLI(true);

export async function dispatchToCopilot(
  prompt: string,
  cwd: string,
  agentMode?: string,
  sessionId?: string,
  featureId?: string
): Promise<ProviderResult> {
  log(`Executing in directory: ${cwd}`);
  
  // Prepend feature tag if starting new session
  let finalPrompt = prompt;
  if (!sessionId && featureId) {
    finalPrompt = `[Feature: ${featureId}]\n\n${prompt}`;
  }
  
  try {
    const result = await copilotCLI.dispatch(finalPrompt, sessionId, {
      model: agentMode === 'auto' ? undefined : agentMode
    });

    return {
      stdout: result.output,
      stderr: '',
      exitCode: 0,
      rawOutput: result.output,
      status: 'SUCCESS',
      output: result.output,
      sessionId: result.sessionId,
      usage: result.usage
    };
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || errorMessage,
      exitCode: error.code || 1,
      rawOutput: errorMessage,
      status: 'FAILED',
      output: errorMessage
    };
  }
}
