'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const env = require('./config/env');
const db = require('./config/db');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/error');
const { success } = require('./utils/response');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
  }),
);
// 8mb accommodates a base64-encoded photo capture (images are capped at 5MB
// raw, which runs ~33% larger once base64-encoded) alongside normal JSON bodies.
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '8mb' }));
app.use(morgan(env.isProduction ? 'combined' : 'dev'));

// Visitor photos are served to a separate frontend origin, so they need a
// relaxed Cross-Origin-Resource-Policy (helmet's default 'same-origin' would
// otherwise let the backend save them but block the browser from rendering
// them as <img> on the deployed frontend's domain).
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(path.resolve(__dirname, '../uploads')),
);

app.get('/health', async (req, res) => {
  try {
    await db.healthCheck();
    success(res, { status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Database is not reachable', details: [] },
    });
  }
});

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
