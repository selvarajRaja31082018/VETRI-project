'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const service = require('../services/notificationService');

const list = asyncHandler(async (req, res) => {
  const notifications = await service.listForUser(req.user.id, { unreadOnly: req.query.unreadOnly === 'true' });
  success(res, notifications);
});

const markRead = asyncHandler(async (req, res) => {
  await service.markRead(req.user.id, req.params.id);
  success(res, null, 'Notification marked as read');
});

module.exports = { list, markRead };
