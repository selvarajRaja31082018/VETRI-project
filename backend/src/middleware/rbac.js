'use strict';

const ApiError = require('../utils/ApiError');

/** Allow the request only for the listed role codes. */
function requireRole(...roleCodes) {
  const allowed = roleCodes.flat();
  return function roleGuard(req, res, next) {
    if (!req.user) return next(ApiError.unauthorized());
    if (!allowed.includes(req.user.roleCode)) {
      return next(ApiError.forbidden('Your role cannot access this resource'));
    }
    next();
  };
}

/** Allow the request only when the user's role grants every listed permission. */
function requirePermission(...permissionCodes) {
  const required = permissionCodes.flat();
  return function permissionGuard(req, res, next) {
    if (!req.user) return next(ApiError.unauthorized());
    const missing = required.filter((code) => !req.user.permissions.includes(code));
    if (missing.length) {
      return next(ApiError.forbidden(`Missing permission: ${missing.join(', ')}`));
    }
    next();
  };
}

module.exports = { requireRole, requirePermission };
