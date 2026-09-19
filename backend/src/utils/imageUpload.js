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
 * Validate and decode a `data:image/...;base64,...` string from a browser
 * canvas/camera capture, without writing anything to disk. Split out from
 * `saveBase64Image` so the capture pipeline can hash the bytes and run the
 * duplicate check *before* deciding whether the file is worth storing.
 */
function decodeBase64Image(dataUrl) {
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

  return { buffer, mimeType: mime, extension: ALLOWED_MIME[mime] };
}

/** Write already-decoded bytes to backend/uploads and describe the stored file. */
function writeImageBuffer({ buffer, extension, publicBaseUrl }) {
  const fileName = `${crypto.randomUUID()}.${extension}`;
  const filePath = path.join(UPLOAD_DIR, fileName);
  fs.writeFileSync(filePath, buffer);

  return {
    fileName,
    // Stored relative so the record survives the upload directory moving.
    filePath: `uploads/${fileName}`,
    url: `${publicBaseUrl}/uploads/${fileName}`,
  };
}

/** Best-effort deletion, used to roll back a write when the DB insert fails. */
function deleteStoredImage(fileName) {
  if (!fileName) return;
  try {
    fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(fileName)));
  } catch {
    /* already gone - nothing to clean up */
  }
}

/**
 * Decode a `data:image/...;base64,...` string from a browser canvas/camera
 * capture and write it to backend/uploads. Returns the public URL to store.
 */
function saveBase64Image(dataUrl, { publicBaseUrl }) {
  const { buffer, extension } = decodeBase64Image(dataUrl);
  return writeImageBuffer({ buffer, extension, publicBaseUrl }).url;
}

module.exports = {
  saveBase64Image,
  decodeBase64Image,
  writeImageBuffer,
  deleteStoredImage,
  UPLOAD_DIR,
  MAX_BYTES,
};
