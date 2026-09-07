'use strict';

const { Router } = require('express');
const controller = require('../controllers/visitorController');
const { validate } = require('../middleware/validate');
const { requirePermission } = require('../middleware/rbac');
const validators = require('../validators/visitorValidators');
const { PERMISSIONS } = require('../utils/constants');

const router = Router();

router.get('/lookup', requirePermission(PERMISSIONS.VISITOR_CREATE), validate(validators.lookup), controller.lookup);
router.get('/', requirePermission(PERMISSIONS.VISITOR_VIEW), validate(validators.list), controller.list);
router.get('/:id', requirePermission(PERMISSIONS.VISITOR_VIEW), validate(validators.getOne), controller.getOne);
router.post('/', requirePermission(PERMISSIONS.VISITOR_CREATE), validate(validators.register), controller.register);
router.put('/:id', requirePermission(PERMISSIONS.VISITOR_UPDATE), validate(validators.update), controller.update);

module.exports = router;
