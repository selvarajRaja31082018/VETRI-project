'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { created } = require('../utils/response');
const { saveBase64Image } = require('../utils/imageUpload');
const { writeAudit, auditContext } = require('../utils/audit');

const uploadPhoto = asyncHandler(async (req, res) => {
  const publicBaseUrl = `${req.protocol}://${req.get('host')}`;
  const url = saveBase64Image(req.body.image, { publicBaseUrl });

  await writeAudit(null, { ...auditContext(req), userId: req.user.id }, {
    action: 'PHOTO_UPLOADED',
    entityType: 'upload',
    newValue: { url },
  });

  created(res, { url }, 'Photo uploaded');
});

module.exports = { uploadPhoto };
