import { envValidationSchema } from './env';

describe('envValidationSchema', () => {
  const validEnv = {
    NODE_ENV: 'development',
    APP_BASE_URL: 'http://localhost:3002',
    FE_BASE_URL: 'http://localhost:3000',
    APP_PORT: 3002,
    CORS_ORIGINS: 'http://localhost:3000',
    DB_URI: 'postgresql://user:pass@localhost:5432/db',
    ENABLE_LOGGING: false,
    JWT_SECRET: 'test-secret',
  };

  it('should validate minimal required env', () => {
    const { error, value } = envValidationSchema.validate(validEnv);
    expect(error).toBeUndefined();
    expect(value.APP_PORT).toBe(3002);
    expect(value.JWT_ACCESS_TOKEN_EXPIRY).toBe('15m');
    expect(value.JWT_REFRESH_TOKEN_EXPIRY).toBe('30d');
  });

  it('should reject missing required APP_BASE_URL', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      APP_BASE_URL: undefined,
    });
    expect(error).toBeDefined();
  });

  it('should reject missing JWT_SECRET', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      JWT_SECRET: undefined,
    });
    expect(error).toBeDefined();
  });

  it('should apply defaults for optional fields', () => {
    const { value } = envValidationSchema.validate(validEnv);
    expect(value.NODE_ENV).toBe('development');
    expect(value.IS_DEV_SANDBOX).toBe('true');
    expect(value.DISABLE_RATE_LIMITS).toBe('true');
  });
});
