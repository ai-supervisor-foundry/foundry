// Execution mode presets for task creation
// Defines provider/model prefills per mode, with full primary/secondary chains for reference.
// @todo — Move to shared package alongside PROVIDER_MODELS and strategies once submodule is set up.

export interface ExecutionModeEntry {
  provider: string;
  agentMode: string;
}

export interface ExecutionModePreset {
  id: string;
  label: string;
  icon: string;
  description: string;
  prefill: { tool: string; agentMode: string };
  primary: ExecutionModeEntry[];
  secondary: ExecutionModeEntry[];
}

export const EXECUTION_MODE_PRESETS: ExecutionModePreset[] = [
  {
    id: 'default',
    label: 'Default',
    icon: '\u2699',
    description: 'Uses the active provider strategy as-is. No provider/model override.',
    prefill: { tool: '', agentMode: '' },
    primary: [],
    secondary: [],
  },
  {
    id: 'normal',
    label: 'Normal',
    icon: '\u25B6',
    description: 'Standard operations. Primary: Claude Sonnet, Cursor Composer 2, Gemini 2.5 Pro.',
    prefill: { tool: 'claude', agentMode: 'claude-sonnet-4-6' },
    primary: [
      { provider: 'claude', agentMode: 'claude-sonnet-4-6' },
      { provider: 'cursor', agentMode: 'composer-2' },
      { provider: 'gemini', agentMode: 'gemini-2.5-pro' },
    ],
    secondary: [
      { provider: 'cursor', agentMode: 'composer-2' },
      { provider: 'gemini', agentMode: 'gemini-2.5-flash' },
      { provider: 'ollama', agentMode: 'phi4-mini' },
    ],
  },
  {
    id: 'thinking',
    label: 'Thinking',
    icon: '\uD83E\uDDE0',
    description: 'Reasoning & analysis. Primary: Claude Opus, Cursor Opus, Gemini 3.1 Pro Preview.',
    prefill: { tool: 'claude', agentMode: 'claude-opus-4-6' },
    primary: [
      { provider: 'claude', agentMode: 'claude-opus-4-6' },
      { provider: 'cursor', agentMode: 'claude-opus-4-6' },
      { provider: 'gemini', agentMode: 'gemini-3.1-pro-preview' },
    ],
    secondary: [
      { provider: 'gemini', agentMode: 'gemini-3.1-flash-preview' },
    ],
  },
  {
    id: 'savings',
    label: 'Savings',
    icon: '\uD83D\uDCB0',
    description: 'Low-cost runs via Cursor Composer tier. Operator may override.',
    prefill: { tool: 'cursor', agentMode: 'composer-2' },
    primary: [
      { provider: 'cursor', agentMode: 'composer-2' },
    ],
    secondary: [
      { provider: 'cursor', agentMode: 'composer-2' },
    ],
  },
];
