'use strict';

const ApiError = require('../utils/ApiError');
const userRepository = require('../repositories/userRepository');
const { verifyPassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const { writeAudit } = require('../utils/audit');

async function login({ identifier, password }, context) {
  const user = await userRepository.findByIdentifierWithSecret(identifier);

  // Same message and roughly the same work for both failure modes.
  if (!user) {
    throw ApiError.unauthorized('Invalid credentials');
  }
  const matches = await verifyPassword(password, user.password_hash);
  if (!matches) {
    await writeAudit(null, { ...context, userId: user.id }, {
      action: 'AUTH_LOGIN_FAILED',
      entityType: 'user',
      entityId: user.id,
    });
    throw ApiError.unauthorized('Invalid credentials');
  }
  if (!user.is_active) {
    throw ApiError.forbidden('This account has been deactivated');
  }

  const authContext = await userRepository.findAuthContextById(user.id);
  const token = signToken({ sub: user.id, role: user.role_code });

  await writeAudit(null, { ...context, userId: user.id }, {
    action: 'AUTH_LOGIN',
    entityType: 'user',
    entityId: user.id,
  });

  return { token, user: publicUser(authContext) };
}

async function me(userId) {
  const user = await userRepository.findAuthContextById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return publicUser(user);
}

async function logout(context) {
  // Stateless JWT: the client discards the token. Recorded for the audit trail.
  await writeAudit(null, context, { action: 'AUTH_LOGOUT', entityType: 'user', entityId: context.userId });
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    roleCode: user.role_code,
    roleName: user.role_name,
    representativeId: user.representative_id || null,
    designation: user.designation || null,
    permissions: user.permissions || [],
  };
}

module.exports = { login, me, logout, publicUser };
