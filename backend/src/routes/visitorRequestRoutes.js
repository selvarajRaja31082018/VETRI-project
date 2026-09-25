'use strict';

const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/visitorRequestController');
const passController = require('../controllers/visitorPassController');
const { validate } = require('../middleware/validate');
const { requirePermission, requireRole } = require('../middleware/rbac');
const validators = require('../validators/visitorRequestValidators');
const { PERMISSIONS, ROLES } = require('../utils/constants');

const router = Router();

/** Sending mail is the one action here that reaches an external system. */
const emailPassLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many emails sent. Try again shortly.', details: [] },
  },
});

router.get('/dashboard', requirePermission(PERMISSIONS.REQUEST_VIEW), controller.dashboard);
router.get('/', requirePermission(PERMISSIONS.REQUEST_VIEW), validate(validators.list), controller.list);
router.get('/:id', requirePermission(PERMISSIONS.REQUEST_VIEW), validate(validators.getOne), controller.getOne);

/*
 * Visitor pass. Scoped to the VISIT rather than the visitor: a returning
 * visitor has one pass per visit, each with its own token, date and queue
 * status, so /visitors/:id could not identify which pass was meant.
 */
router.get(
  '/:id/pass',
  requirePermission(PERMISSIONS.REQUEST_VIEW),
  validate(validators.getOne),
  passController.getPass,
);
router.get(
  '/:id/verify',
  requirePermission(PERMISSIONS.REQUEST_VIEW),
  validate(validators.getOne),
  passController.verifyPass,
);
router.post(
  '/:id/email-pass',
  requirePermission(PERMISSIONS.VISITOR_CREATE),
  emailPassLimiter,
  validate(validators.emailPass),
  passController.emailPass,
);

router.put(
  '/:id/approve',
  requirePermission(PERMISSIONS.REQUEST_APPROVE),
  validate(validators.approve),
  controller.approve,
);
router.put(
  '/:id/reject',
  requirePermission(PERMISSIONS.REQUEST_REJECT),
  validate(validators.reject),
  controller.reject,
);
router.put(
  '/:id/assign',
  requirePermission(PERMISSIONS.REQUEST_ASSIGN),
  validate(validators.assign),
  controller.assign,
);
router.put(
  '/:id/queue',
  requirePermission(PERMISSIONS.REQUEST_APPROVE),
  validate(validators.queue),
  controller.queue,
);
router.put(
  '/:id/schedule',
  requirePermission(PERMISSIONS.REQUEST_APPROVE),
  validate(validators.scheduleAppointment),
  controller.scheduleAppointment,
);
router.put(
  '/:id/resolve',
  requirePermission(PERMISSIONS.REQUEST_RESOLVE),
  validate(validators.resolve),
  controller.resolve,
);
router.put(
  '/:id/cancel',
  requireRole(ROLES.OFFICE, ROLES.ADMIN),
  validate(validators.cancel),
  controller.cancel,
);
router.put(
  '/:id/priority',
  requirePermission(PERMISSIONS.REQUEST_APPROVE),
  validate(validators.setPriority),
  controller.setPriority,
);
router.put(
  '/:id/refer',
  requirePermission(PERMISSIONS.REQUEST_ASSIGN),
  validate(validators.referToDepartment),
  controller.referToDepartment,
);

module.exports = router;
