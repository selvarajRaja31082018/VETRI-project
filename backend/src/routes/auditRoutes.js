'use strict';

const { Router } = require('express');
const controller = require('../controllers/auditController');
const { validate } = require('../middleware/validate');
const { requirePermission } = require('../middleware/rbac');
const validators = require('../validators/auditValidators');
const { PERMISSIONS } = require('../utils/constants');

const router = Router();
router.use(requirePermission(PERMISSIONS.AUDIT_VIEW));

router.get('/', validate(validators.list), controller.list);
router.get('/actions', controller.actions);

module.exports = router;
