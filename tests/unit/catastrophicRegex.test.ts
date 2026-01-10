
import { attemptDeterministicValidation } from '../../src/application/services/deterministicValidator';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('DeterministicValidator - Regex Safety', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'regex-safety-test-'));
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'some content');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should reject catastrophic patterns', async () => {
    const result = await attemptDeterministicValidation(
      ['Check for bad pattern'],
      '',
      tempDir,
      {
        bad_pattern: {
          confidence: 'medium',
          keywords: [/bad/],
          checks: [
            { type: 'grep_found', path: 'test.txt', pattern: '(.*)+' } // Catastrophic
          ]
        }
      }
    );

    // Should fail safe (return false for valid) or handle gracefully
    // Current impl returns false for 'valid' if check fails or returns false
    expect(result.valid).toBe(false);
  });

  it('should handle safe patterns correctly', async () => {
    const result = await attemptDeterministicValidation(
      ['Check for good pattern'],
      '',
      tempDir,
      {
        good_pattern: {
          confidence: 'medium',
          keywords: [/good/],
          checks: [
            { type: 'grep_found', path: 'test.txt', pattern: 'content' }
          ]
        }
      }
    );

    expect(result.valid).toBe(true);
  });
});
