import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  it('hashPassword("Test123!") produces bcrypt hash starting with $2', async () => {
    const hashStr = await service.hashPassword('Test123!');
    expect(hashStr).toMatch(/^\$2/);
  });

  it('verifyPassword("Test123!", hash) returns true', async () => {
    const hashStr = await service.hashPassword('Test123!');
    const result = await service.verifyPassword('Test123!', hashStr);
    expect(result).toBe(true);
  });

  it('verifyPassword("WrongPassword", hash) returns false', async () => {
    const hashStr = await service.hashPassword('Test123!');
    const result = await service.verifyPassword('WrongPassword', hashStr);
    expect(result).toBe(false);
  });

  it('hashes are unique each time (bcrypt salt)', async () => {
    const hash1 = await service.hashPassword('Test123!');
    const hash2 = await service.hashPassword('Test123!');
    expect(hash1).not.toBe(hash2);
    expect(await service.verifyPassword('Test123!', hash1)).toBe(true);
    expect(await service.verifyPassword('Test123!', hash2)).toBe(true);
  });

  describe('validatePasswordStrength', () => {
    it('accepts "Test123!" as valid', () => {
      const result = service.validatePasswordStrength('Test123!');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects short password', () => {
      const result = service.validatePasswordStrength('Ab1!');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('8'))).toBe(true);
    });

    it('rejects without uppercase', () => {
      const result = service.validatePasswordStrength('test123!');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('uppercase'))).toBe(true);
    });

    it('rejects without number', () => {
      const result = service.validatePasswordStrength('TestAbcd!');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('number'))).toBe(true);
    });

    it('rejects without special char', () => {
      const result = service.validatePasswordStrength('Test1234');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('special'))).toBe(true);
    });
  });
});
