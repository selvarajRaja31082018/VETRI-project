'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const authService = require('../services/authService');
const { auditContext } = require('../utils/audit');

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, auditContext(req));
  success(res, result, 'Login successful');
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(auditContext(req));
  success(res, null, 'Logged out');
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.me(req.user.id);
  success(res, user);
});

module.exports = { login, logout, me };
