'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ApiError = require('./ApiError');

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

/**
 * Decode a `data:image/...;base64,...` string from a browser canvas/camera
 * capture and write it to backend/uploads. Returns the public URL to store.
 */
function saveBase64Image(dataUrl, { publicBaseUrl }) {
  if (typeof dataUrl !== 'string') {
    throw ApiError.badRequest('Image data is required');
  }
  const match = dataUrl.match(DATA_URL_PATTERN);
  if (!match) {
    throw ApiError.badRequest('Image must be a base64-encoded JPEG, PNG or WebP data URL');
  }

  const [, mime, base64] = match;
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0) {
    throw ApiError.badRequest('Image data is empty');
  }
  if (buffer.length > MAX_BYTES) {
    throw ApiError.badRequest('Image must be smaller than 5MB');
  }

  const extension = ALLOWED_MIME[mime];
  const filename = `${crypto.randomUUID()}.${extension}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);

  return `${publicBaseUrl}/uploads/${filename}`;
}

module.exports = { saveBase64Image, UPLOAD_DIR };
