'use strict';

const { Router } = require('express');
const controller = require('../controllers/visitorRequestController');
const { validate } = require('../middleware/validate');
const { requirePermission } = require('../middleware/rbac');
const validators = require('../validators/visitorRequestValidators');
const { PERMISSIONS } = require('../utils/constants');

// Mounted at /api/v1/visitor-requests/:id/check-in|check-out for the design's
// "POST /visitors/:id/check-in" intent (checking in the *request*, since a
// visitor may have several requests over time).
const router = Router();

router.post('/:id/check-in', requirePermission(PERMISSIONS.CHECKIN_MANAGE), validate(validators.idOnly), controller.checkIn);
router.post('/:id/check-out', requirePermission(PERMISSIONS.CHECKIN_MANAGE), validate(validators.idOnly), controller.checkOut);

module.exports = router;
