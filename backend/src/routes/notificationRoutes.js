'use strict';

const { Router } = require('express');
const controller = require('../controllers/notificationController');
const { validate } = require('../middleware/validate');
const { idParam } = require('../validators/common');

const router = Router();

router.get('/', controller.list);
router.put('/:id/read', validate({ params: idParam }), controller.markRead);

module.exports = router;
