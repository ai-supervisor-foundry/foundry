import { SessionManager } from '../../../src/domain/agents/sessionManager';
import { SupervisorState, SessionInfo } from '../../../src/domain/types/types';
import { createMockState } from '../../fixtures/mockData';
import { Provider } from '../../../src/domain/agents/enums/provider';

// Mock the provider CLI modules
jest.mock('../../../src/infrastructure/connectors/agents/providers/geminiCLI', () => ({
  geminiCLI: {
    listSessions: jest.fn(),
  },
}));

jest.mock('../../../src/infrastructure/connectors/agents/providers/copilotCLI', () => ({
  copilotCLI: {
    listSessions: jest.fn(),
  },
}));

import { geminiCLI } from '../../../src/infrastructure/connectors/agents/providers/geminiCLI';
import { copilotCLI } from '../../../src/infrastructure/connectors/agents/providers/copilotCLI';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockState: SupervisorState;

  beforeEach(() => {
    sessionManager = new SessionManager();
    mockState = createMockState();
    jest.clearAllMocks();
  });

  describe('resolveSession', () => {
    describe('Session ID override precedence', () => {
      it('should return override session ID when provided', async () => {
        const overrideId = 'override-session-123';
        const featureId = 'feature-auth';
        
        const result = await sessionManager.resolveSession(
          Provider.GEMINI,
          featureId,
          overrideId,
          mockState
        );

        expect(result).toBe(overrideId);
      });

      it('should prioritize override over active sessions in state', async () => {
        const overrideId = 'override-session-123';
        const featureId = 'feature-auth';
        mockState.active_sessions = {
          [featureId]: {
            session_id: 'state-session-456',
            provider: Provider.GEMINI,
            last_used: new Date().toISOString(),
            error_count: 0,
            feature_id: featureId,
          },
        };

        const result = await sessionManager.resolveSession(
          Provider.GEMINI,
          featureId,
          overrideId,
          mockState
        );

        expect(result).toBe(overrideId);
        expect(result).not.toBe('state-session-456');
      });

      it('should use override even when featureId is undefined', async () => {
        const overrideId = 'override-session-123';

        const result = await sessionManager.resolveSession(
          Provider.GEMINI,
          undefined,
          overrideId,
          mockState
        );

        expect(result).toBe(overrideId);
      });
    });

    describe('Feature-based session lookup from state', () => {
      it('should return session from active_sessions when feature ID matches', async () => {
        const featureId = 'feature-payment';
        const sessionId = 'active-session-789';
        mockState.active_sessions = {
          [featureId]: {
            session_id: sessionId,
            provider: Provider.GEMINI,
            last_used: new Date().toISOString(),
            error_count: 0,
            feature_id: featureId,
          },
        };

        const result = await sessionManager.resolveSession(
          Provider.GEMINI,
          featureId,
          undefined,
          mockState
        );

        expect(result).toBe(sessionId);
      });

      it('should return undefined when feature ID not in active_sessions', async () => {
        const featureId = 'feature-nonexistent';
        mockState.active_sessions = {
          'feature-other': {
            session_id: 'other-session',
            provider: Provider.GEMINI,
            last_used: new Date().toISOString(),
            error_count: 0,
            feature_id: 'feature-other',
          },
        };

        const result = await sessionManager.resolveSession(
          Provider.GEMINI,
          featureId,
          undefined,
          mockState
        );

        // Should attempt discovery since not in state
        expect(result).toBeUndefined();
      });

      it('should handle empty active_sessions object', async () => {
        const featureId = 'feature-auth';
        mockState.active_sessions = {};

        const result = await sessionManager.resolveSession(
          Provider.GEMINI,
          featureId,
          undefined,
          mockState
        );

        expect(result).toBeUndefined();
      });

      it('should handle undefined active_sessions', async () => {
        const featureId = 'feature-auth';
        mockState.active_sessions = undefined;

        const result = await sessionManager.resolveSession(
          Provider.GEMINI,
          featureId,
          undefined,
          mockState
        );

        expect(result).toBeUndefined();
      });
    });

    describe('Session discovery for Gemini', () => {
      it('should discover Gemini session when feature tag matches', async () => {
        const featureId = 'feature-auth';
        const discoveredSessionId = 'gemini-discovered-123';
        
        (geminiCLI.listSessions as jest.Mock).mockResolvedValue([
          {
            snippet: '[Feature: feature-auth] Implementing authentication',
            timeRelative: '2 hours ago',
            sessionId: discoveredSessionId,
          },
          {
            snippet: '[Feature: feature-other] Other task',
            timeRelative: '1 day ago',
            sessionId: 'other-session',
          },
        ]);

        const result = await sessionManager.resolveSession(
          Provider.GEMINI,
          featureId,
          undefined,
          mockState
        );

        expect(result).toBe(discoveredSessionId);
        expect(geminiCLI.listSessions).toHaveBeenCalledTimes(1);
      });

      it('should update state with discovered session', async () => {
        const featureId = 'feature-auth';
        const discoveredSessionId = 'gemini-discovered-456';
        
        (geminiCLI.listSessions as jest.Mock).mockResolvedValue([
          {
            snippet: '[Feature: feature-auth] Task description',
            timeRelative: '30 minutes ago',
            sessionId: discoveredSessionId,
          },
        ]);

        await sessionManager.resolveSession(
          Provider.GEMINI,
          featureId,
          undefined,
          mockState
        );

        expect(mockState.active_sessions).toBeDefined();
        expect(mockState.active_sessions![featureId]).toBeDefined();
        expect(mockState.active_sessions![featureId].session_id).toBe(discoveredSessionId);
        expect(mockState.active_sessions![featureId].provider).toBe('gemini');
        expect(mockState.active_sessions![featureId].feature_id).toBe(featureId);
      });

      it('should filter out old sessions (months/years ago)', async () => {
        const featureId = 'feature-auth';
        
        (geminiCLI.listSessions as jest.Mock).mockResolvedValue([
          {
            snippet: '[Feature: feature-auth] Old session',
            timeRelative: '2 months ago',
            sessionId: 'old-session-1',
          },
          {
            snippet: '[Feature: feature-auth] Ancient session',
            timeRelative: '1 year ago',
            sessionId: 'old-session-2',
          },
        ]);

        const result = await sessionManager.resolveSession(
          Provider.GEMINI,
          featureId,
          undefined,
          mockState
        );

        expect(result).toBeUndefined();
      });

      it('should handle Gemini listSessions failure gracefully', async () => {
        const featureId = 'feature-auth';
        
        (geminiCLI.listSessions as jest.Mock).mockRejectedValue(new Error('API error'));

        const result = await sessionManager.resolveSession(
          Provider.GEMINI,
          featureId,
          undefined,
          mockState
        );

        expect(result).toBeUndefined();
        expect(geminiCLI.listSessions).toHaveBeenCalledTimes(1);
      });

      it('should work with GEMINI_STUB provider', async () => {
        const featureId = 'feature-test';
        const discoveredSessionId = 'stub-session-123';
        
        (geminiCLI.listSessions as jest.Mock).mockResolvedValue([
          {
            snippet: '[Feature: feature-test] Test task',
            timeRelative: '1 hour ago',
            sessionId: discoveredSessionId,
          },
        ]);

        const result = await sessionManager.resolveSession(
          Provider.GEMINI_STUB,
          featureId,
          undefined,
          mockState
        );

        expect(result).toBe(discoveredSessionId);
      });
    });

    describe('Session discovery for Copilot', () => {
      it('should discover Copilot session when feature tag matches', async () => {
        const featureId = 'feature-dashboard';
        const discoveredSessionId = 'copilot-discovered-789';
        
        (copilotCLI.listSessions as jest.Mock).mockResolvedValue([
          {
            snippet: '[Feature: feature-dashboard] Building dashboard',
            timeRelative: '3 hours ago',
            sessionId: discoveredSessionId,
          },
        ]);

        const result = await sessionManager.resolveSession(
          Provider.COPILOT,
          featureId,
          undefined,
          mockState
        );

        expect(result).toBe(discoveredSessionId);
        expect(copilotCLI.listSessions).toHaveBeenCalledTimes(1);
      });

      it('should update state with discovered Copilot session', async () => {
        const featureId = 'feature-api';
        const discoveredSessionId = 'copilot-api-session';
        
        (copilotCLI.listSessions as jest.Mock).mockResolvedValue([
          {
            snippet: '[Feature: feature-api] API implementation',
            timeRelative: '15 minutes ago',
            sessionId: discoveredSessionId,
          },
        ]);

        await sessionManager.resolveSession(
          Provider.COPILOT,
          featureId,
          undefined,
          mockState
        );

        expect(mockState.active_sessions![featureId].session_id).toBe(discoveredSessionId);
        expect(mockState.active_sessions![featureId].provider).toBe('copilot');
      });

      it('should handle Copilot listSessions failure gracefully', async () => {
        const featureId = 'feature-api';
        
        (copilotCLI.listSessions as jest.Mock).mockRejectedValue(new Error('Network error'));

        const result = await sessionManager.resolveSession(
          Provider.COPILOT,
          featureId,
          undefined,
          mockState
        );

        expect(result).toBeUndefined();
        expect(copilotCLI.listSessions).toHaveBeenCalledTimes(1);
      });
    });

    describe('Provider routing', () => {
      it('should not attempt discovery for unsupported providers', async () => {
        const featureId = 'feature-test';

        const result = await sessionManager.resolveSession(
          Provider.CURSOR,
          featureId,
          undefined,
          mockState
        );

        expect(result).toBeUndefined();
        expect(geminiCLI.listSessions).not.toHaveBeenCalled();
        expect(copilotCLI.listSessions).not.toHaveBeenCalled();
      });

      it('should handle unknown provider strings gracefully', async () => {
        const featureId = 'feature-test';

        const result = await sessionManager.resolveSession(
          'unknown-provider',
          featureId,
          undefined,
          mockState
        );

        expect(result).toBeUndefined();
      });
    });

    describe('Edge cases', () => {
      it('should return undefined when featureId is undefined and no override', async () => {
        const result = await sessionManager.resolveSession(
          Provider.GEMINI,
          undefined,
          undefined,
          mockState
        );

        expect(result).toBeUndefined();
        expect(geminiCLI.listSessions).not.toHaveBeenCalled();
      });

      it('should handle empty sessions list from provider', async () => {
        const featureId = 'feature-auth';
        
        (geminiCLI.listSessions as jest.Mock).mockResolvedValue([]);

        const result = await sessionManager.resolveSession(
          Provider.GEMINI,
          featureId,
          undefined,
          mockState
        );

        expect(result).toBeUndefined();
      });

      it('should handle sessions without matching feature tag', async () => {
        const featureId = 'feature-auth';
        
        (geminiCLI.listSessions as jest.Mock).mockResolvedValue([
          {
            snippet: 'No feature tag here',
            timeRelative: '1 hour ago',
            sessionId: 'session-123',
          },
          {
            snippet: '[Feature: different-feature] Other task',
            timeRelative: '2 hours ago',
            sessionId: 'session-456',
          },
        ]);

        const result = await sessionManager.resolveSession(
          Provider.GEMINI,
          featureId,
          undefined,
          mockState
        );

        expect(result).toBeUndefined();
      });

      it('should prefer most recent session if multiple matches', async () => {
        const featureId = 'feature-auth';
        
        (geminiCLI.listSessions as jest.Mock).mockResolvedValue([
          {
            snippet: '[Feature: feature-auth] Older session',
            timeRelative: '5 hours ago',
            sessionId: 'older-session',
          },
          {
            snippet: '[Feature: feature-auth] Newer session',
            timeRelative: '1 hour ago',
            sessionId: 'newer-session',
          },
        ]);

        const result = await sessionManager.resolveSession(
          Provider.GEMINI,
          featureId,
          undefined,
          mockState
        );

        // Should return the first matching session (which is the older one in the mock)
        expect(result).toBe('older-session');
      });
    });

    describe('Session continuity', () => {
      it('should not call listSessions if session is already in state', async () => {
        const featureId = 'feature-payment';
        const existingSessionId = 'existing-session-123';
        mockState.active_sessions = {
          [featureId]: {
            session_id: existingSessionId,
            provider: Provider.GEMINI,
            last_used: new Date().toISOString(),
            error_count: 0,
            feature_id: featureId,
          },
        };

        const result = await sessionManager.resolveSession(
          Provider.GEMINI,
          featureId,
          undefined,
          mockState
        );

        expect(result).toBe(existingSessionId);
        expect(geminiCLI.listSessions).not.toHaveBeenCalled();
      });

      it('should preserve session metadata when returning from state', async () => {
        const featureId = 'feature-auth';
        const timestamp = '2026-01-04T10:00:00.000Z';
        mockState.active_sessions = {
          [featureId]: {
            session_id: 'session-123',
            provider: Provider.GEMINI,
            last_used: timestamp,
            error_count: 2,
            feature_id: featureId,
          },
        };

        await sessionManager.resolveSession(
          Provider.GEMINI,
          featureId,
          undefined,
          mockState
        );

        expect(mockState.active_sessions[featureId].error_count).toBe(2);
        expect(mockState.active_sessions[featureId].last_used).toBe(timestamp);
      });
    });
  });
});
