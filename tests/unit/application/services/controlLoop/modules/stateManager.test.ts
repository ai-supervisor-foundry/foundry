import { StateManager } from '../../../../../../src/application/services/controlLoop/modules/stateManager';
import { PersistenceLayer } from '../../../../../../src/application/services/persistence';
import { SupervisorState } from '../../../../../../src/domain/types/types';

describe('StateManager', () => {
  let mockPersistence: jest.Mocked<PersistenceLayer>;
  let stateManager: StateManager;

  beforeEach(() => {
    mockPersistence = {
      readState: jest.fn(),
      writeState: jest.fn(),
    } as any;
    stateManager = new StateManager(mockPersistence);
  });

  describe('loadState', () => {
    it('should read state from persistence layer', async () => {
      const mockState = { supervisor: { status: 'RUNNING' } } as SupervisorState;
      mockPersistence.readState.mockResolvedValue(mockState);

      const result = await stateManager.loadState(1);
      
      expect(mockPersistence.readState).toHaveBeenCalled();
      expect(result).toBe(mockState);
    });
  });

  describe('validateRequiredFields', () => {
    it('should throw if supervisor field is missing', () => {
      const invalidState = {} as SupervisorState;
      expect(() => stateManager.validateRequiredFields(invalidState, 1))
        .toThrow('Missing required field: supervisor');
    });

    it('should pass for valid state', () => {
      const validState = {
        supervisor: { status: 'RUNNING' },
        goal: {},
        queue: {}
      } as SupervisorState;
      expect(() => stateManager.validateRequiredFields(validState, 1)).not.toThrow();
    });
  });
});
