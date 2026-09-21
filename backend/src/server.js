'use strict';

const env = require('./config/env');
const app = require('./app');
const db = require('./config/db');
const socketGateway = require('./realtime/socketGateway');
const logger = require('./utils/logger');

async function start() {
  try {
    await db.healthCheck();
    logger.info('Database connection established');
  } catch (error) {
    logger.error('Could not connect to the database. Is MySQL running and .env configured?', error.message);
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    logger.info(`VETRI API listening on port ${env.port} (${env.nodeEnv})`);
  });

  // Real-time capture events ride on the same HTTP server, so there is one
  // port, one TLS certificate and one origin to configure.
  socketGateway.attach(server);
  logger.info('Socket.IO gateway attached at /socket.io');

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(async () => {
      await socketGateway.close();
      await db.pool.end();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', reason);
  });
}

start();
