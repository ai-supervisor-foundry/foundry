import { SessionInfo, SupervisorState } from '../types/types';
import { geminiCLI } from '../../infrastructure/connectors/agents/providers/geminiCLI';
import { copilotCLI } from '../../infrastructure/connectors/agents/providers/copilotCLI';
import { log as logShared } from '../../infrastructure/adapters/logging/logger';
import { Provider } from './enums/provider';

function log(message: string, ...args: unknown[]): void {
  logShared('SessionManager', message, ...args);
}

export class SessionManager {
  /**
   * Resolve an active session for a task, either from state or by discovering it from the provider.
   * Currently supports auto-discovery for Gemini.
   */
  async resolveSession(
    tool: string,
    featureId: string | undefined,
    sessionIdOverride: string | undefined,
    state: SupervisorState
  ): Promise<string | undefined> {
    // 1. Explicit override takes precedence
    if (sessionIdOverride) {
      return sessionIdOverride;
    }

    // 2. Feature-based lookup
    if (featureId) {
      // Check active state first
      if (state.active_sessions?.[featureId]) {
        const session = state.active_sessions[featureId];
        log(`Found active session in state for feature ${featureId}: ${session.session_id}`);
        return session.session_id;
      }

      // Check recovery (Smart Selection) - Provider specific
      if (tool === Provider.GEMINI || tool === Provider.GEMINI_STUB) {
        return await this.discoverGeminiSession(featureId, state);
      }
      if (tool === Provider.COPILOT) {
        return await this.discoverCopilotSession(featureId, state);
      }
    }

    return undefined;
  }

  private async discoverGeminiSession(featureId: string, state: SupervisorState): Promise<string | undefined> {
    log(`Attempting Gemini session discovery for feature: ${featureId}`);
    try {
      const sessions = await geminiCLI.listSessions();
      log(`Gemini CLI returned ${sessions.length} sessions`);

      // Immediate fallback if discovery returns nothing (CLI might not support listing or be empty)
      if (sessions.length === 0) {
        if (state.active_sessions?.[featureId]) {
          const session = state.active_sessions[featureId];
          log(`Session discovery empty, using state fallback: ${session.session_id}`);
          return session.session_id;
        }
        return undefined;
      }

      return await this.matchAndRegisterSession(sessions, featureId, 'gemini', state);
    } catch (error) {
      log(`Gemini session discovery failed: ${error instanceof Error ? error.message : String(error)}`);
      
      // Fallback on error
      if (state.active_sessions?.[featureId]) {
        const session = state.active_sessions[featureId];
        log(`Error recovery: Using session from state: ${session.session_id}`);
        return session.session_id;
      }
    }
    return undefined;
  }

  private async discoverCopilotSession(featureId: string, state: SupervisorState): Promise<string | undefined> {
    log(`Attempting Copilot session discovery for feature: ${featureId}`);
    try {
      const sessions = await copilotCLI.listSessions();
      log(`Copilot CLI returned ${sessions.length} sessions`);

      // Immediate fallback
      if (sessions.length === 0) {
        if (state.active_sessions?.[featureId]) {
          const session = state.active_sessions[featureId];
          log(`Session discovery empty, using state fallback: ${session.session_id}`);
          return session.session_id;
        }
        return undefined;
      }

      return await this.matchAndRegisterSession(sessions, featureId, 'copilot', state);
    } catch (error) {
      log(`Copilot session discovery failed: ${error instanceof Error ? error.message : String(error)}`);
      
      // Fallback on error
      if (state.active_sessions?.[featureId]) {
        const session = state.active_sessions[featureId];
        log(`Error recovery: Using session from state: ${session.session_id}`);
        return session.session_id;
      }
    }
    return undefined;
  }

  private async matchAndRegisterSession(
    sessions: Array<{ snippet: string, timeRelative: string, sessionId: string }>,
    featureId: string,
    provider: string,
    state: SupervisorState
  ): Promise<string | undefined> {
    // Filter for sessions from last week (simple heuristic: look for "days ago", "hours ago", "minutes ago")
    // And match feature tag
    const matchedSession = sessions.find(s => {
      const isRecent = !s.timeRelative.includes('month') && !s.timeRelative.includes('year');
      return isRecent && s.snippet.includes(`[Feature: ${featureId}]`);
    });

    if (matchedSession) {
      const sessionId = matchedSession.sessionId;
      log(`Discovered existing ${provider} session: ${sessionId} for feature: ${featureId}`);
      
      // Update state immediately to avoid re-discovery
      if (!state.active_sessions) state.active_sessions = {};
      state.active_sessions[featureId] = {
        session_id: sessionId,
        provider: provider,
        last_used: new Date().toISOString(),
        error_count: 0,
        feature_id: featureId
      };
      
      return sessionId;
    }
    
    // If no match found but state has one, trust state? 
    // Usually if listSessions succeeds but doesn't have the session, it might be gone.
    // But let's be conservative and trust state if it exists, to avoid losing context on CLI glitches.
    if (state.active_sessions?.[featureId]) {
        const session = state.active_sessions[featureId];
        log(`No matching session found in CLI list, but state has one. Keeping state session: ${session.session_id}`);
        return session.session_id;
    }

    return undefined;
  }
}

export const sessionManager = new SessionManager();