// Execution mode types — presets are fetched from backend /api/config/execution-modes

export interface ExecutionModeEntry {
  provider: string;
  agentMode: string;
}

export interface ExecutionMode {
  id: string;
  label: string;
  icon: string;
  description: string;
  builtin?: boolean;
  prefill: { tool: string; agentMode: string };
  primary: ExecutionModeEntry[];
  secondary: ExecutionModeEntry[];
}

export interface Strategy {
  id: string;
  name: string;
  builtin: boolean;
  primary: ExecutionModeEntry[];
  secondary: ExecutionModeEntry[];
}

// Minimal fallback if API is unreachable (default-only)
export const FALLBACK_MODES: ExecutionMode[] = [
  {
    id: 'default',
    label: 'Default',
    icon: '\u2699',
    description: 'Uses the active provider strategy as-is.',
    prefill: { tool: '', agentMode: '' },
    primary: [],
    secondary: [],
  },
];
