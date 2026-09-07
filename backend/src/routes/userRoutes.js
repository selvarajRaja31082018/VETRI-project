'use strict';

const { Router } = require('express');
const controller = require('../controllers/userController');
const { validate } = require('../middleware/validate');
const { requirePermission } = require('../middleware/rbac');
const validators = require('../validators/userValidators');
const { PERMISSIONS } = require('../utils/constants');

const router = Router();
router.use(requirePermission(PERMISSIONS.USER_MANAGE));

router.get('/', validate(validators.list), controller.list);
router.get('/:id', validate(validators.getOne), controller.getOne);
router.post('/', validate(validators.create), controller.create);
router.put('/:id', validate(validators.update), controller.update);
router.put('/:id/status', validate(validators.setStatus), controller.setStatus);
router.post('/:id/reset-password', validate(validators.getOne), controller.resetPassword);

module.exports = router;
