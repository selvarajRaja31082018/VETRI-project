'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const { auditContext } = require('../utils/audit');
const visitorPassService = require('../services/visitorPassService');

/** Full pass for the operator's screen, print view and PDF. */
const getPass = asyncHandler(async (req, res) => {
  const pass = await visitorPassService.getPass(req.params.id);
  success(res, { pass, emailAvailable: visitorPassService.isEmailConfigured() });
});

/** Narrow payload behind a scanned QR code. */
const verifyPass = asyncHandler(async (req, res) => {
  const verification = await visitorPassService.verifyPass(req.params.id);
  success(res, verification);
});

const emailPass = asyncHandler(async (req, res) => {
  const result = await visitorPassService.emailPass(req.params.id, req.body.email, auditContext(req));
  success(res, result, 'Visitor pass sent successfully');
});

module.exports = { getPass, verifyPass, emailPass };
