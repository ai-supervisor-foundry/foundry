// Halt Detection unit tests

import {
  containsAmbiguity,
  checkHardHalts,
  ProviderResult,
} from '../../../src/domain/executors/haltDetection';

describe('HaltDetection', () => {
  describe('containsAmbiguity', () => {
    it('should detect "maybe" ambiguity', () => {
      expect(containsAmbiguity('Maybe we should do this')).toBe(true);
    });

    it('should detect "could" ambiguity', () => {
      expect(containsAmbiguity('This could be implemented in several ways')).toBe(true);
    });

    it('should detect "suggest" ambiguity', () => {
      expect(containsAmbiguity('I suggest using approach A or B')).toBe(true);
    });

    it('should detect "recommend" ambiguity', () => {
      expect(containsAmbiguity('I recommend considering alternative approaches')).toBe(true);
    });

    it('should detect "alternative" ambiguity', () => {
      expect(containsAmbiguity('Here are alternative solutions')).toBe(true);
    });

    it('should detect "option" ambiguity', () => {
      expect(containsAmbiguity('You have this option available')).toBe(true);
    });

    it('should not detect ambiguity in clear statements', () => {
      expect(containsAmbiguity('The implementation is complete')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(containsAmbiguity('MAYBE this works')).toBe(true);
      expect(containsAmbiguity('Maybe THIS WORKS')).toBe(true);
    });

    it('should use word boundaries', () => {
      // "maybe" should be detected as word, not substring in "maybelline"
      expect(containsAmbiguity('This is maybe good')).toBe(true);
      // But "maybelline" should not trigger ambiguity for "maybe"
      expect(containsAmbiguity('Maybelline cosmetics')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(containsAmbiguity('')).toBe(false);
    });

    it('should handle very long texts', () => {
      const longText = 'x'.repeat(10000) + ' maybe ' + 'y'.repeat(10000);
      expect(containsAmbiguity(longText)).toBe(true);
    });
  });

  describe('checkHardHalts', () => {
    const createProviderResult = (overrides?: Partial<ProviderResult>): ProviderResult => ({
      stdout: '',
      stderr: '',
      exitCode: 0,
      rawOutput: '',
      ...overrides,
    });

    it('should detect execution failure on non-zero exit code', () => {
      const result = createProviderResult({ exitCode: 1, stderr: 'Error occurred' });
      const halt = checkHardHalts(result);

      expect(halt).toBeDefined();
      expect(halt).toBe('CURSOR_EXEC_FAILURE');
    });

    it('should not halt on successful execution', () => {
      const result = createProviderResult({
        exitCode: 0,
        stdout: '{"status": "completed"}',
      });
      const halt = checkHardHalts(result);

      expect(halt).toBeNull();
    });

    it('should detect question markers', () => {
      const result = createProviderResult({
        stdout: 'Should I implement this function?',
      });
      const halt = checkHardHalts(result);

      expect(halt).toBeDefined();
      expect(halt).toBe('ASKED_QUESTION');
    });

    it('should detect ambiguous language', () => {
      const result = createProviderResult({
        stdout: 'I could implement this in multiple ways',
      });
      const halt = checkHardHalts(result);

      expect(halt).toBeDefined();
      expect(halt).toBe('AMBIGUITY');
    });

    it('should detect invalid JSON when required', () => {
      const result = createProviderResult({
        stdout: 'Not valid JSON',
        exitCode: 0,
      });
      const halt = checkHardHalts(result);

      expect(halt).toBeDefined();
    });

    it('should validate required keys in JSON', () => {
      const result = createProviderResult({
        stdout: '{"incomplete": "data"}',
        exitCode: 0,
      });
      const halt = checkHardHalts(result);

      expect(halt).toBeDefined();
    });

    it('should pass with valid JSON and all required keys', () => {
      const result = createProviderResult({
        stdout: '{"status": "completed", "result": "success"}',
        exitCode: 0,
      });
      const halt = checkHardHalts(result);

      expect(halt).toBeNull();
    });

    it('should prioritize execution errors over other halts', () => {
      const result = createProviderResult({
        exitCode: 1,
        stderr: 'Fatal error',
        stdout: 'Maybe this could work?',
      });
      const halt = checkHardHalts(result);

      expect(halt).toBe('CURSOR_EXEC_FAILURE');
    });

    it('should detect circuit breaker status', () => {
      const result = createProviderResult({
        stdout: 'Circuit breaker is open',
        exitCode: 0,
      });
      const halt = checkHardHalts(result);

      expect(halt).toBeDefined();
    });
  });
});
