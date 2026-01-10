import { DeterministicValidator } from '../../../../../src/domain/policies/validation/deterministicValidator';
import { ValidationContext } from '../../../../../src/domain/policies/validation/validationStrategy';
import { Task, ValidationReport } from '../../../../../src/domain/types/types';
import * as detValidatorModule from '../../../../../src/application/services/deterministicValidator';
import { LoggerPort } from '../../../../../src/domain/ports/logger';

jest.mock('../../../../../src/application/services/deterministicValidator');
jest.mock('../../../../../src/application/services/analytics');

describe('DeterministicValidator', () => {
  let strategy: DeterministicValidator;
  let mockContext: ValidationContext;
  let mockTask: Task;
  let mockLogger: LoggerPort;

  beforeEach(() => {
    process.env.HELPER_DETERMINISTIC_ENABLED = 'true';
    process.env.HELPER_DETERMINISTIC_PERCENT = '100';
    
    mockLogger = {
      log: jest.fn(),
      logVerbose: jest.fn(),
      logPerformance: jest.fn(),
      logStateTransition: jest.fn(),
      logError: jest.fn(),
    };
    
    strategy = new DeterministicValidator(mockLogger);
    mockContext = {
      iteration: 1,
      sandboxCwd: '/tmp',
      projectId: 'test',
      state: {} as any
    };
    mockTask = { task_id: 't1' } as Task;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.HELPER_DETERMINISTIC_ENABLED;
    delete process.env.HELPER_DETERMINISTIC_PERCENT;
  });

  it('should return valid report immediately if previous was valid', async () => {
    const prevReport = { valid: true, rules_passed: [], rules_failed: [] };
    const mockProviderResult = { stdout: '', stderr: '', exitCode: 0, rawOutput: '' };
    const result = await strategy.validate(mockTask, mockProviderResult, mockContext, prevReport);
    expect(result).toBe(prevReport);
    expect(detValidatorModule.attemptDeterministicValidation).not.toHaveBeenCalled();
  });

  it('should attempt deterministic validation if feature flag enabled', async () => {
    const prevReport = { valid: false, rules_passed: [], rules_failed: [] };
    
    (detValidatorModule.attemptDeterministicValidation as jest.Mock).mockResolvedValue({
      canValidate: true,
      valid: true,
      confidence: 'high',
      reason: 'file match'
    });

    const mockProviderResult = { stdout: '', stderr: '', exitCode: 0, rawOutput: '' };
    const result = await strategy.validate(mockTask, mockProviderResult, mockContext, prevReport);
    
    expect(detValidatorModule.attemptDeterministicValidation).toHaveBeenCalled();
    expect(result.valid).toBe(true);
    expect(result.confidence).toBe('HIGH');
  });

  it('should skip if feature flag disabled', async () => {
    process.env.HELPER_DETERMINISTIC_ENABLED = 'false';
    const prevReport = { valid: false, rules_passed: [], rules_failed: [] };
    
    const mockProviderResult = { stdout: '', stderr: '', exitCode: 0, rawOutput: '' };
    const result = await strategy.validate(mockTask, mockProviderResult, mockContext, prevReport);
    
    expect(detValidatorModule.attemptDeterministicValidation).not.toHaveBeenCalled();
    expect(result.valid).toBe(false);
  });
});
