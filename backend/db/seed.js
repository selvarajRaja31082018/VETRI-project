'use strict';

/**
 * Seeds roles, permissions, role_permissions and one development administrator.
 * Also seeds the reason-for-visit / department master lists referenced by the
 * prototype so the Gate/PA/Representative dropdowns are not empty on first run.
 *
 * Requires SEED_ADMIN_PASSWORD in .env - refuses to run without it so a real
 * deployment is never left with a guessable default admin password.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const { ROLES, ROLE_PERMISSIONS, PERMISSIONS, VISITOR_TYPES } = require('../src/utils/constants');

const ROLE_NAMES = {
  [ROLES.GATE]: 'Gate Operator',
  [ROLES.OFFICE]: 'Office Staff / PA',
  [ROLES.REPRESENTATIVE]: 'Elected Representative',
  [ROLES.ADMIN]: 'Administrator',
};

const DEFAULT_DEPARTMENTS = [
  'Greater Chennai Corporation',
  'Revenue Administration',
  'Social Welfare',
  'School Education',
  'Health & Family Welfare',
  'Public Works Department',
];

const DEFAULT_REASONS = {
  'General Public': ['Grievance submission', 'Ration follow-up', 'Welfare assistance', 'Civic issue', 'Public meeting request'],
  'Entity Employee': ['Employment issue', 'Transfer request'],
  'Party Cadre': ['Party programme', 'Local coordination'],
  'Govt Staff': ['Departmental coordination'],
  Personal: ['Personal meeting request'],
};

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('SEED_ADMIN_PASSWORD is not set in .env - refusing to seed a default admin password.');
    process.exit(1);
  }
  if (adminPassword.length < 8) {
    console.error('SEED_ADMIN_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vetri',
  });

  try {
    console.log('Seeding roles...');
    for (const code of Object.values(ROLES)) {
      await connection.query(
        `INSERT INTO roles (code, name) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [code, ROLE_NAMES[code]],
      );
    }

    console.log('Seeding permissions...');
    for (const code of Object.values(PERMISSIONS)) {
      await connection.query(
        `INSERT INTO permissions (code, name) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [code, code],
      );
    }

    console.log('Seeding role -> permission grants...');
    const [roleRows] = await connection.query('SELECT id, code FROM roles');
    const [permissionRows] = await connection.query('SELECT id, code FROM permissions');
    const roleIdByCode = Object.fromEntries(roleRows.map((r) => [r.code, r.id]));
    const permissionIdByCode = Object.fromEntries(permissionRows.map((p) => [p.code, p.id]));

    for (const [roleCode, permissionCodes] of Object.entries(ROLE_PERMISSIONS)) {
      for (const permCode of permissionCodes) {
        await connection.query(
          `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
          [roleIdByCode[roleCode], permissionIdByCode[permCode]],
        );
      }
    }

    console.log('Seeding development administrator...');
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@vetri.local';
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await connection.query(
      `INSERT INTO users (role_id, name, email, password_hash, is_active)
       VALUES (?, 'System Administrator', ?, ?, 1)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), is_active = 1`,
      [roleIdByCode[ROLES.ADMIN], adminEmail, passwordHash],
    );

    console.log('Seeding department master list...');
    for (const name of DEFAULT_DEPARTMENTS) {
      await connection.query(
        `INSERT INTO departments (name) VALUES (?) ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [name],
      );
    }

    console.log('Seeding reason-for-visit master list...');
    for (const visitorType of VISITOR_TYPES) {
      for (const reason of DEFAULT_REASONS[visitorType] || []) {
        await connection.query(
          `INSERT INTO visit_reasons (visitor_type, reason) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE reason = VALUES(reason)`,
          [visitorType, reason],
        );
      }
    }

    console.log('\nSeed complete.');
    console.log(`Development administrator: ${adminEmail} / (the password from SEED_ADMIN_PASSWORD)`);
    console.log('Create Gate Operator, Office Staff and Representative accounts from Admin > Users.');
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
