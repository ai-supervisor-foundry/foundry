// Port: Command Executor
// Interface for executing OS commands

import { CommandExecutionResult } from '../types/types';

export interface CommandExecutorPort {
  /**
   * Execute a list of shell commands
   */
  executeVerificationCommands(
    commands: string[],
    cwd: string
  ): Promise<CommandExecutionResult>;
}
