import { CommandExecutorPort } from '../../../domain/ports/commandExecutor';
import { executeVerificationCommands } from '../../connectors/os/executors/commandExecutor';
import { CommandExecutionResult } from '../../../domain/types/types';

export class CommandExecutorAdapter implements CommandExecutorPort {
  async executeVerificationCommands(
    commands: string[],
    cwd: string
  ): Promise<CommandExecutionResult> {
    return executeVerificationCommands(commands, cwd);
  }
}
