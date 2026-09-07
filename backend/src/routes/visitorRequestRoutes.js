'use strict';

const { Router } = require('express');
const controller = require('../controllers/visitorRequestController');
const { validate } = require('../middleware/validate');
const { requirePermission, requireRole } = require('../middleware/rbac');
const validators = require('../validators/visitorRequestValidators');
const { PERMISSIONS, ROLES } = require('../utils/constants');

const router = Router();

router.get('/dashboard', requirePermission(PERMISSIONS.REQUEST_VIEW), controller.dashboard);
router.get('/', requirePermission(PERMISSIONS.REQUEST_VIEW), validate(validators.list), controller.list);
router.get('/:id', requirePermission(PERMISSIONS.REQUEST_VIEW), validate(validators.getOne), controller.getOne);

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
