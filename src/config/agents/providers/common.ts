// Default priority order: Gemini → Cursor → Codex → Claude

import { Provider } from "../../../domain/agents/enums/provider";

// Gemini first for better performance, Claude moved to end due to payment requirements
export const DEFAULT_PRIORITY: Provider[] = [
    // Provider.GEMINI,
    Provider.COPILOT,
    // Provider.CURSOR,
    // Provider.CODEX,
    // Provider.CLAUDE,
    // Provider.GEMINI_STUB,
];