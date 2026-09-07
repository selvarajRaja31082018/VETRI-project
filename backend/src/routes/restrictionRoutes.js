'use strict';

const { Router } = require('express');
const controller = require('../controllers/restrictionController');
const { validate } = require('../middleware/validate');
const { requirePermission } = require('../middleware/rbac');
const validators = require('../validators/restrictionValidators');
const { PERMISSIONS } = require('../utils/constants');

const router = Router();

router.get('/', controller.list);
router.post(
  '/:id',
  requirePermission(PERMISSIONS.RESTRICTION_MANAGE),
  validate(validators.restrict),
  controller.restrict,
);
router.post('/:id/attempt', validate(validators.idOnly), controller.recordAttempt);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.RESTRICTION_MANAGE),
  validate(validators.idOnly),
  controller.release,
);

module.exports = router;
