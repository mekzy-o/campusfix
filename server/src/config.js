/**
 * Central configuration. Every environment variable the API reads is
 * declared here so the rest of the code never touches process.env directly.
 */
require('dotenv').config({ quiet: true });

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';
const isTest = env === 'test';

function required(name, fallback) {
  const value = process.env[name];
  if (value) return value;
  if (isProd) throw new Error(`Missing required environment variable: ${name}`);
  return fallback;
}

const databaseUrl = isTest
  ? process.env.TEST_DATABASE_URL || 'postgres://postgres@localhost:5432/campusfix_test'
  : required('DATABASE_URL', 'postgres://postgres@localhost:5432/campusfix');

module.exports = {
  env,
  isProd,
  isTest,
  port: Number(process.env.PORT) || 4000,
  databaseUrl,
  // Neon / most hosted Postgres providers require TLS.
  databaseSsl: process.env.DATABASE_SSL === 'true' || /sslmode=require/.test(databaseUrl),
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
  },
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS) || 7,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  uploads: {
    maxFileSizeBytes: 3 * 1024 * 1024, // 3 MB per image
    maxFiles: 4,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'CampusFix <no-reply@campusfix.app>',
  },
};
