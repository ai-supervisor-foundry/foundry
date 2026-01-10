import { attemptDeterministicValidation } from '../../src/application/services/deterministicValidator';
import { DETERMINISTIC_VALIDATION_RULES } from '../../src/config/deterministicValidationRules';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('DeterministicValidator', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'validator-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should validate expo project creation criteria', async () => {
    // Setup: Create mock file system
    await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ dependencies: { expo: '^50.0.0' } }));
    await fs.writeFile(path.join(tempDir, 'app.json'), '{}');
    await fs.writeFile(path.join(tempDir, 'tsconfig.json'), '{}');

    // Execute
    const result = await attemptDeterministicValidation(
      ['Expo project created successfully'], 
      '', 
      tempDir, 
      DETERMINISTIC_VALIDATION_RULES
    );

    // Assert
    expect(result.canValidate).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.confidence).toBe('high');
  });

  it('should detect missing files for expo project', async () => {
    // Setup: Empty directory (missing package.json etc.)

    // Execute
    const result = await attemptDeterministicValidation(
      ['Expo project created successfully'], 
      '', 
      tempDir, 
      DETERMINISTIC_VALIDATION_RULES
    );

    // Assert
    expect(result.canValidate).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.confidence).toBe('high');
  });

  it('should validate no boilerplate criteria', async () => {
    // Setup: Create src directory with few files, no boilerplate
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'src/App.tsx'), 'console.log("Hello")');
    await fs.writeFile(path.join(tempDir, 'src/index.ts'), '');

    // Execute
    const result = await attemptDeterministicValidation(
      ['No boilerplate code found'], 
      '', 
      tempDir, 
      DETERMINISTIC_VALIDATION_RULES
    );

    // Assert
    expect(result.canValidate).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.confidence).toBe('medium');
  });

  it('should fail validation if boilerplate text exists', async () => {
    // Setup: Create src directory with boilerplate text
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'src/App.tsx'), '// This is a demo app');

    // Execute
    const result = await attemptDeterministicValidation(
      ['No boilerplate code found'], 
      '', 
      tempDir, 
      DETERMINISTIC_VALIDATION_RULES
    );

    // Assert
    expect(result.canValidate).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.confidence).toBe('medium');
  });

  it('should return canValidate=false for semantic criteria', async () => {
    // Execute
    const result = await attemptDeterministicValidation(
      ['Code is readable and maintainable'], 
      '', 
      tempDir, 
      DETERMINISTIC_VALIDATION_RULES
    );

    // Assert
    expect(result.canValidate).toBe(false);
    expect(result.confidence).toBe('low');
  });

  it('should validate partial success (some criteria deterministic, some not)', async () => {
     // Setup
     await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ dependencies: { expo: '^50.0.0' } }));
     await fs.writeFile(path.join(tempDir, 'app.json'), '{}');
     await fs.writeFile(path.join(tempDir, 'tsconfig.json'), '{}');

     // Execute
     const result = await attemptDeterministicValidation(
         ['Expo project created', 'UI is beautiful'],
         '',
         tempDir,
         DETERMINISTIC_VALIDATION_RULES
     );

     // Assert
     expect(result.canValidate).toBe(false); // Because "UI is beautiful" cannot be validated deterministically
     expect(result.confidence).toBe('low');
  });

  it('should validate prisma setup specifically', async () => {
    await fs.mkdir(path.join(tempDir, 'prisma'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'prisma/schema.prisma'), '');
    await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ dependencies: { '@prisma/client': 'latest' } }));

    const result = await attemptDeterministicValidation(
      ['Prisma setup complete'], 
      '', 
      tempDir, 
      DETERMINISTIC_VALIDATION_RULES
    );

    expect(result.canValidate).toBe(true);
    expect(result.valid).toBe(true);
  });

  it('should NOT validate generic database setup (fallback to helper)', async () => {
    // Generic requests should not trigger specific rules to avoid false negatives
    const result = await attemptDeterministicValidation(
      ['Database setup complete'], 
      '', 
      tempDir, 
      DETERMINISTIC_VALIDATION_RULES
    );

    expect(result.canValidate).toBe(false);
  });

  it('should validate documentation updated criteria', async () => {
    await fs.writeFile(path.join(tempDir, 'README.md'), '# New Documentation');

    const result = await attemptDeterministicValidation(
      ['Update README with new findings'], 
      '', 
      tempDir, 
      DETERMINISTIC_VALIDATION_RULES
    );

    expect(result.valid).toBe(true);
  });

  it('should validate config files criteria', async () => {
    await fs.writeFile(path.join(tempDir, '.env.example'), '');
    await fs.writeFile(path.join(tempDir, '.gitignore'), '');
    await fs.writeFile(path.join(tempDir, 'docker-compose.yml'), '');

    const result = await attemptDeterministicValidation(
      ['Create .env.example and docker-compose files'], 
      '', 
      tempDir, 
      DETERMINISTIC_VALIDATION_RULES
    );

    expect(result.valid).toBe(true);
  });

  it('should respect file size limits (skip large files)', async () => {
    // Create a large file (600KB > 512KB limit)
    const largeContent = 'A'.repeat(600 * 1024);
    await fs.writeFile(path.join(tempDir, 'large.ts'), largeContent);

    // Try to grep it
    const result = await attemptDeterministicValidation(
      ['Find pattern in large file'], 
      '', 
      tempDir, 
      {
        large_file_check: {
          confidence: 'medium',
          keywords: [/find.*pattern/i],
          checks: [{ type: 'grep_found', path: 'large.ts', pattern: 'AAAA' }]
        }
      }
    );

    // Should return false because it skipped the file (or failed to read it)
    expect(result.valid).toBe(false);
  });
});
