'use strict';

const db = require('../config/db');

const BASE_SELECT = `
  SELECT u.id, u.name, u.email, u.mobile, u.is_active, u.role_id, u.created_at, u.updated_at,
         r.code AS role_code, r.name AS role_name,
         rep.id AS representative_id, rep.designation
  FROM users u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN representatives rep ON rep.user_id = u.id
`;

async function findAuthContextById(id) {
  const user = await db.queryOne(
    `${BASE_SELECT} WHERE u.id = ? AND u.deleted_at IS NULL`,
    [id],
  );
  if (!user) return null;
  const permissions = await db.query(
    `SELECT p.code FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.role_id = ?`,
    [user.role_id],
  );
  return { ...user, permissions: permissions.map((row) => row.code) };
}

/** Login lookup: accepts email or mobile, returns the password hash. */
async function findByIdentifierWithSecret(identifier) {
  return db.queryOne(
    `SELECT u.*, r.code AS role_code, r.name AS role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE (u.email = ? OR u.mobile = ?) AND u.deleted_at IS NULL
     LIMIT 1`,
    [identifier, identifier],
  );
}

async function findById(id) {
  return db.queryOne(`${BASE_SELECT} WHERE u.id = ? AND u.deleted_at IS NULL`, [id]);
}

async function findByEmail(email) {
  if (!email) return null;
  return db.queryOne('SELECT id FROM users WHERE email = ? AND deleted_at IS NULL', [email]);
}

async function search({ search, roleCode, isActive, limit, offset }) {
  const where = ['u.deleted_at IS NULL'];
  const params = [];

  if (search) {
    where.push('(u.name LIKE ? OR u.email LIKE ? OR u.mobile LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (roleCode) {
    where.push('r.code = ?');
    params.push(roleCode);
  }
  if (isActive !== undefined) {
    where.push('u.is_active = ?');
    params.push(isActive ? 1 : 0);
  }

  const clause = `WHERE ${where.join(' AND ')}`;
  const rows = await db.query(
    `${BASE_SELECT} ${clause} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const { total } = await db.queryOne(
    `SELECT COUNT(*) AS total FROM users u JOIN roles r ON r.id = u.role_id ${clause}`,
    params,
  );
  return { rows, total };
}

async function create(executor, { roleId, name, email, mobile, passwordHash, isActive = true }) {
  const result = await (executor || db).query(
    `INSERT INTO users (role_id, name, email, mobile, password_hash, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [roleId, name, email || null, mobile || null, passwordHash, isActive ? 1 : 0],
  );
  return result.insertId;
}

async function update(executor, id, fields) {
  const map = {
    roleId: 'role_id',
    name: 'name',
    email: 'email',
    mobile: 'mobile',
    passwordHash: 'password_hash',
    isActive: 'is_active',
  };
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(map)) {
    if (fields[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(typeof fields[key] === 'boolean' ? Number(fields[key]) : fields[key]);
    }
  }
  if (!sets.length) return;
  params.push(id);
  await (executor || db).query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
}

async function countActive() {
  const row = await db.queryOne(
    'SELECT COUNT(*) AS total FROM users WHERE is_active = 1 AND deleted_at IS NULL',
  );
  return row.total;
}

module.exports = {
  findAuthContextById,
  findByIdentifierWithSecret,
  findById,
  findByEmail,
  search,
  create,
  update,
  countActive,
};
