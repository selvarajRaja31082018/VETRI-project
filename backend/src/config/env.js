'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function required(key, fallback) {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || 'vetri',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  },
  jwt: {
    secret: required('JWT_SECRET', process.env.NODE_ENV === 'production' ? undefined : 'dev-only-insecure-secret'),
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  /**
   * Origin baked into the mobile-capture QR code. A phone cannot resolve
   * `localhost`, so on a LAN setup this must be the machine's reachable HTTPS
   * origin (e.g. https://192.168.1.20:5173) - browsers only expose
   * getUserMedia on a secure context. Falls back to FRONTEND_URL.
   */
  publicAppUrl: process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173',
  /** Origins allowed to call the API. Mobile devices hit it from PUBLIC_APP_URL. */
  get corsOrigins() {
    return [...new Set([this.frontendUrl, this.publicAppUrl].filter(Boolean))];
  },
};

env.isProduction = env.nodeEnv === 'production';

module.exports = env;
