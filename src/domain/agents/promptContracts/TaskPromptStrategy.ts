// --- Strategy Pattern for Prompt Construction ---

export interface TaskPromptStrategy {
    getRules(agentMode: string): string[];
    getOutputRequirements(): string[];
  }
  