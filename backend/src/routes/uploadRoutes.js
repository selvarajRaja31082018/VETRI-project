'use strict';

const { Router } = require('express');
const controller = require('../controllers/uploadController');
const { validate } = require('../middleware/validate');
const { requirePermission } = require('../middleware/rbac');
const validators = require('../validators/uploadValidators');
const { PERMISSIONS } = require('../utils/constants');

const router = Router();

router.post(
  '/photo',
  requirePermission(PERMISSIONS.VISITOR_CREATE),
  validate(validators.uploadPhoto),
  controller.uploadPhoto,
);

module.exports = router;
