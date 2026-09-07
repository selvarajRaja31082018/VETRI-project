'use strict';

const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../utils/jwt');
const userRepository = require('../repositories/userRepository');

/**
 * Verifies the bearer token and loads the current user (including role code and
 * permissions) onto `req.user`. Never trusts anything the client sends beyond
 * the signed token.
 */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Missing authentication token');
    }

    let payload;
    try {
      payload = verifyToken(header.slice(7).trim());
    } catch (error) {
      throw ApiError.unauthorized(
        error.name === 'TokenExpiredError' ? 'Session expired, please sign in again' : 'Invalid authentication token',
      );
    }

    const user = await userRepository.findAuthContextById(payload.sub);
    if (!user || !user.is_active || user.deleted_at) {
      throw ApiError.unauthorized('Account is not active');
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.role_id,
      roleCode: user.role_code,
      roleName: user.role_name,
      representativeId: user.representative_id || null,
      permissions: user.permissions,
    };
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { authenticate };
