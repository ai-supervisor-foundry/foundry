import { PromptLoggerPort, PromptLogEntry } from '../../../domain/ports/logger';
import { appendPromptLog } from './promptLogger';

export class PromptLoggerAdapter implements PromptLoggerPort {
  async appendPromptLog(
    sandboxRoot: string,
    projectId: string,
    entry: PromptLogEntry
  ): Promise<void> {
    // Cast to any because the implementation expects a type from a different file
    // but the structure is compatible.
    await appendPromptLog(entry as any, sandboxRoot, projectId);
  }
}
