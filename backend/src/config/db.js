'use strict';

const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: ['DATE'],
  timezone: 'local',
  charset: 'utf8mb4_general_ci',
});

/** Run a parameterised query and return the rows. */
async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/** Run a parameterised query and return the first row (or null). */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length ? rows[0] : null;
}

/**
 * Run `fn` inside a transaction. The callback receives a connection whose
 * `query`/`queryOne` helpers mirror the module-level ones.
 */
async function transaction(fn) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const tx = {
      connection,
      async query(sql, params = []) {
        const [rows] = await connection.query(sql, params);
        return rows;
      },
      async queryOne(sql, params = []) {
        const rows = await tx.query(sql, params);
        return rows.length ? rows[0] : null;
      },
    };
    const result = await fn(tx);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function healthCheck() {
  await query('SELECT 1');
}

module.exports = { pool, query, queryOne, transaction, healthCheck };
