'use strict';

const { Router } = require('express');
const controller = require('../controllers/masterDataController');
const { validate } = require('../middleware/validate');
const { requirePermission } = require('../middleware/rbac');
const validators = require('../validators/masterDataValidators');
const { PERMISSIONS } = require('../utils/constants');

const router = Router();

// Read access: any authenticated role needs these dropdowns.
router.get('/representatives', controller.listRepresentatives);
router.get('/departments', controller.listDepartments);
router.get('/visit-reasons', validate(validators.listReasons), controller.listReasons);

// Write access: Administrator only.
router.post(
  '/departments',
  requirePermission(PERMISSIONS.MASTER_DATA_MANAGE),
  validate(validators.addDepartment),
  controller.addDepartment,
);
router.put(
  '/departments/:id/status',
  requirePermission(PERMISSIONS.MASTER_DATA_MANAGE),
  validate(validators.departmentStatus),
  controller.setDepartmentActive,
);
router.post(
  '/visit-reasons',
  requirePermission(PERMISSIONS.MASTER_DATA_MANAGE),
  validate(validators.addReason),
  controller.addReason,
);
router.put(
  '/visit-reasons/:id/status',
  requirePermission(PERMISSIONS.MASTER_DATA_MANAGE),
  validate(validators.reasonStatus),
  controller.setReasonActive,
);

router.get('/settings', requirePermission(PERMISSIONS.SETTINGS_MANAGE), controller.listSettings);
router.put(
  '/settings/:key',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validate(validators.updateSetting),
  controller.updateSetting,
);

module.exports = router;
