'use strict';

const { Router } = require('express');
const controller = require('../controllers/reportController');
const { validate } = require('../middleware/validate');
const { requirePermission } = require('../middleware/rbac');
const validators = require('../validators/reportValidators');
const { PERMISSIONS } = require('../utils/constants');

const router = Router();
router.use(requirePermission(PERMISSIONS.REPORT_VIEW));

router.get('/visitors', validate(validators.query), controller.visitors);
router.get('/requests', validate(validators.query), controller.requests);
router.get('/meetings', validate(validators.query), controller.meetings);
router.get('/representatives', validate(validators.query), controller.representatives);
router.get('/resolutions', validate(validators.query), controller.resolutions);
router.get('/trends', controller.trends);

module.exports = router;
