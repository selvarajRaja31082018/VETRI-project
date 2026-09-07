'use strict';

/**
 * Minimal migration runner: creates the database if missing, then executes
 * db/schema.sql statement-by-statement (idempotent - every table uses
 * CREATE TABLE IF NOT EXISTS). Pass --fresh to drop and recreate all tables.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_NAME = process.env.DB_NAME || 'vetri';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

const FRESH = process.argv.includes('--fresh');

// Table drop order respects foreign key dependencies (children first).
const DROP_ORDER = [
  'audit_logs',
  'notifications',
  'settings',
  'restricted_entries',
  'complaints',
  'visitor_status_history',
  'meetings',
  'appointments',
  'visit_group_members',
  'visitor_requests',
  'visit_reasons',
  'visitors',
  'departments',
  'representatives',
  'role_permissions',
  'permissions',
  'users',
  'roles',
];

function splitStatements(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const bootstrap = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
  });

  await bootstrap.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`,
  );
  await bootstrap.end();

  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    multipleStatements: true,
  });

  try {
    if (FRESH) {
      console.log('--fresh flag set: dropping existing VETRI tables...');
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const table of DROP_ORDER) {
        await connection.query(`DROP TABLE IF EXISTS \`${table}\``);
      }
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    const schemaSql = fs.readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf8');
    const statements = splitStatements(schemaSql);

    console.log(`Applying ${statements.length} schema statements to database "${DB_NAME}"...`);
    for (const statement of statements) {
      await connection.query(statement);
    }

    console.log('Migration complete.');
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
