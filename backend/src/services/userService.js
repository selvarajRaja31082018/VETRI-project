'use strict';

const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const userRepository = require('../repositories/userRepository');
const masterDataRepository = require('../repositories/masterDataRepository');
const { hashPassword } = require('../utils/password');
const { writeAudit } = require('../utils/audit');
const { getPagination } = require('../utils/pagination');
const { ROLES } = require('../utils/constants');
const crypto = require('crypto');

async function list(query) {
  const { page, limit, offset } = getPagination(query);
  const { rows, total } = await userRepository.search({
    search: query.search,
    roleCode: query.role,
    isActive: query.status === undefined ? undefined : query.status === 'active',
    limit,
    offset,
  });
  return { rows, total, page, limit };
}

async function getById(id) {
  const user = await userRepository.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

async function create(payload, context) {
  if (payload.email) {
    const existing = await userRepository.findByEmail(payload.email);
    if (existing) throw ApiError.conflict('A user with this email already exists');
  }

  const roleRow = await db.queryOne('SELECT id, code FROM roles WHERE code = ?', [payload.roleCode]);
  if (!roleRow) throw ApiError.badRequest('Unknown role');

  const password = payload.password || crypto.randomBytes(9).toString('base64url');
  const passwordHash = await hashPassword(password);

  const userId = await db.transaction(async (tx) => {
    const id = await userRepository.create(tx, {
      roleId: roleRow.id,
      name: payload.name,
      email: payload.email,
      mobile: payload.mobile,
      passwordHash,
      isActive: payload.isActive ?? true,
    });

    if (roleRow.code === ROLES.REPRESENTATIVE) {
      await masterDataRepository.createRepresentative(tx, {
        userId: id,
        designation: payload.designation,
      });
    }

    await writeAudit(tx, context, {
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: id,
      newValue: { name: payload.name, email: payload.email, roleCode: payload.roleCode },
    });
    return id;
  });

  const user = await userRepository.findById(userId);
  // Temporary password is returned once so the admin can share it out-of-band.
  return { ...user, temporaryPassword: payload.password ? undefined : password };
}

async function update(id, payload, context) {
  const existing = await userRepository.findById(id);
  if (!existing) throw ApiError.notFound('User not found');

  let roleId;
  if (payload.roleCode) {
    const roleRow = await db.queryOne('SELECT id FROM roles WHERE code = ?', [payload.roleCode]);
    if (!roleRow) throw ApiError.badRequest('Unknown role');
    roleId = roleRow.id;
  }

  await db.transaction(async (tx) => {
    await userRepository.update(tx, id, {
      roleId,
      name: payload.name,
      email: payload.email,
      mobile: payload.mobile,
    });
    await writeAudit(tx, context, {
      action: 'USER_UPDATED',
      entityType: 'user',
      entityId: id,
      oldValue: existing,
      newValue: payload,
    });
  });

  return userRepository.findById(id);
}

async function setStatus(id, isActive, context) {
  const existing = await userRepository.findById(id);
  if (!existing) throw ApiError.notFound('User not found');
  if (!isActive && existing.id === context.userId) {
    throw ApiError.badRequest('You cannot deactivate your own account');
  }

  await db.transaction(async (tx) => {
    await userRepository.update(tx, id, { isActive });
    await writeAudit(tx, context, {
      action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entityType: 'user',
      entityId: id,
      oldValue: { is_active: existing.is_active },
      newValue: { is_active: isActive },
    });
  });

  return userRepository.findById(id);
}

async function resetPassword(id, context) {
  const existing = await userRepository.findById(id);
  if (!existing) throw ApiError.notFound('User not found');

  const password = crypto.randomBytes(9).toString('base64url');
  const passwordHash = await hashPassword(password);

  await db.transaction(async (tx) => {
    await userRepository.update(tx, id, { passwordHash });
    await writeAudit(tx, context, {
      action: 'USER_PASSWORD_RESET',
      entityType: 'user',
      entityId: id,
    });
  });

  return { temporaryPassword: password };
}

module.exports = { list, getById, create, update, setStatus, resetPassword };
