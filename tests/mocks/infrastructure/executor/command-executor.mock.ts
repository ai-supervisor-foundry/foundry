import { CommandExecutorPort } from '@/domain/ports/commandExecutor';
import { CommandExecutionResult, CommandResult } from '@/domain/types/types';

export class CommandExecutorMock implements CommandExecutorPort {
  private commandResponses: Map<string, CommandResult> = new Map();
  private callHistory: { commands: string[]; cwd: string }[] = [];
  private defaultResponse: CommandResult = {
    command: 'default',
    exitCode: 0,
    stdout: '',
    stderr: '',
    passed: true,
  };

  async executeVerificationCommands(
    commands: string[],
    cwd: string
  ): Promise<CommandExecutionResult> {
    this.callHistory.push({ commands, cwd });

    const results: CommandResult[] = commands.map(cmd => {
      // Find a matching command in our responses
      const matchingKey = Array.from(this.commandResponses.keys()).find(key => 
        cmd.includes(key)
      );

      const response = matchingKey 
        ? this.commandResponses.get(matchingKey)! 
        : { ...this.defaultResponse, command: cmd };

      return response;
    });

    return {
      passed: results.every(r => r.passed),
      results,
    };
  }

  // --- Mock Configuration ---
  setCommandResponse(commandPattern: string, response: Partial<CommandResult>): void {
    this.commandResponses.set(commandPattern, {
      command: commandPattern,
      exitCode: response.exitCode ?? 0,
      stdout: response.stdout ?? '',
      stderr: response.stderr ?? '',
      passed: response.passed ?? (response.exitCode === 0),
    });
  }

  setDefaultResponse(response: Partial<CommandResult>): void {
    this.defaultResponse = {
      command: 'default',
      exitCode: response.exitCode ?? 0,
      stdout: response.stdout ?? '',
      stderr: response.stderr ?? '',
      passed: response.passed ?? (response.exitCode === 0),
    };
  }

  getCallHistory() {
    return [...this.callHistory];
  }

  reset(): void {
    this.commandResponses.clear();
    this.callHistory = [];
  }
}
