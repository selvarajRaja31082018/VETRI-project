'use strict';

const { Router } = require('express');
const controller = require('../controllers/meetingController');
const { validate } = require('../middleware/validate');
const { requirePermission } = require('../middleware/rbac');
const validators = require('../validators/meetingValidators');
const { PERMISSIONS } = require('../utils/constants');

const router = Router();

router.get('/', requirePermission(PERMISSIONS.MEETING_START), validate(validators.list), controller.list);
router.get('/:id', requirePermission(PERMISSIONS.MEETING_START), validate(validators.getOne), controller.getOne);
router.post('/', requirePermission(PERMISSIONS.MEETING_START), validate(validators.start), controller.start);
router.put(
  '/:id/start',
  requirePermission(PERMISSIONS.MEETING_START),
  validate(validators.getOne),
  (req, res, next) => {
    req.body.visitorRequestId = req.body.visitorRequestId || req.params.id;
    next();
  },
  controller.start,
);
router.put(
  '/:id/complete',
  requirePermission(PERMISSIONS.MEETING_COMPLETE),
  validate(validators.complete),
  controller.complete,
);

module.exports = router;
