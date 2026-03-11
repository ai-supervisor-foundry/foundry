import * as Joi from 'joi';

export type EnvProps = {
  NODE_ENV: string;
  APP_BASE_URL: string;
  FE_BASE_URL: string;
  APP_PORT: number;
  CORS_ORIGINS: string;
  DB_URI: string;
  ENABLE_LOGGING: string;
  JWT_SECRET: string;
  JWT_ACCESS_TOKEN_EXPIRY?: string;
  JWT_REFRESH_TOKEN_EXPIRY?: string;
  IS_DEV_SANDBOX?: string;
  DISABLE_RATE_LIMITS?: string;
};

export const envValidationSchema = Joi.object<EnvProps>({
  NODE_ENV: Joi.string().default('development'),
  APP_BASE_URL: Joi.string().uri().required(),
  FE_BASE_URL: Joi.string().uri().required(),
  APP_PORT: Joi.number().required(),
  CORS_ORIGINS: Joi.string().required(),
  DB_URI: Joi.string().required(),
  ENABLE_LOGGING: Joi.boolean().default(false),
  JWT_SECRET: Joi.string().required(),
  JWT_ACCESS_TOKEN_EXPIRY: Joi.string().optional().default('15m'),
  JWT_REFRESH_TOKEN_EXPIRY: Joi.string().optional().default('30d'),
  IS_DEV_SANDBOX: Joi.string()
    .valid('true', 'false')
    .optional()
    .default('true'),
  DISABLE_RATE_LIMITS: Joi.string()
    .valid('true', 'false')
    .optional()
    .default('true'),
});
