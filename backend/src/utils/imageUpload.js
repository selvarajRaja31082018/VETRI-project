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

/**
 * Accept a capture in either supported form and return decoded bytes:
 *
 *   - `file`    a multer memory-storage upload (multipart/form-data)
 *   - `dataUrl` a `data:image/...;base64,...` string (the original JSON form)
 *
 * Both are validated the same way - the MIME type is taken from the bytes'
 * declared type and checked against the allow-list, and a client-supplied
 * filename is ignored entirely.
 */
function decodeUpload({ file, dataUrl }) {
  if (file) {
    const extension = ALLOWED_MIME[file.mimetype];
    if (!extension) {
      throw ApiError.badRequest('Image must be a JPEG, PNG or WebP file');
    }
    if (!file.buffer || file.buffer.length === 0) {
      throw ApiError.badRequest('Image data is empty');
    }
    if (file.buffer.length > MAX_BYTES) {
      throw ApiError.badRequest('Image must be smaller than 5MB');
    }
    return { buffer: file.buffer, mimeType: file.mimetype, extension };
  }
  return decodeBase64Image(dataUrl);
}

/** Only ids we generated (UUIDs) may become path segments - never client text. */
function safeSegment(value) {
  if (typeof value !== 'string') return null;
  return /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null;
}

/**
 * Write already-decoded bytes into a dated, session-scoped directory:
 *
 *   uploads/YYYY/MM/DD/<session>/<device>/<imageId>.<ext>
 *
 * Partitioning by date keeps any one directory small enough to stay fast, and
 * grouping by session/device makes a capture traceable straight from the
 * filesystem. The name is always derived from the server-generated image id -
 * a client-supplied filename is never used as a storage path.
 */
function writeImageBuffer({ buffer, extension, publicBaseUrl, sessionId, deviceId, imageId }) {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  // A desktop capture outside any session still needs a stable home.
  const sessionSegment = safeSegment(sessionId) || 'standalone';
  const deviceSegment = safeSegment(deviceId) || 'local';
  const fileName = `${safeSegment(imageId) || crypto.randomUUID()}.${extension}`;

  const absoluteDir = path.join(UPLOAD_DIR, year, month, day, sessionSegment, deviceSegment);
  fs.mkdirSync(absoluteDir, { recursive: true });
  fs.writeFileSync(path.join(absoluteDir, fileName), buffer);

  const storageKey = path.posix.join(year, month, day, sessionSegment, deviceSegment, fileName);
  const relativePath = path.posix.join('uploads', storageKey);

  return {
    fileName,
    // Relative to the backend root, so the record survives the upload
    // directory being moved or remounted.
    filePath: relativePath,
    // What deleteStoredImage needs to find the file again.
    storageKey,
    url: `${publicBaseUrl}/${relativePath}`,
  };
}

/**
 * Best-effort deletion, used to roll back a write when the DB insert fails.
 * Takes the `storageKey` returned by writeImageBuffer. The resolved path is
 * checked to sit inside UPLOAD_DIR so a malformed key cannot escape it.
 */
function deleteStoredImage(storageKey) {
  if (!storageKey) return;
  try {
    const root = path.resolve(UPLOAD_DIR);
    const target = path.resolve(root, storageKey);
    if (target !== root && !target.startsWith(root + path.sep)) return;
    fs.unlinkSync(target);
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
  decodeUpload,
  writeImageBuffer,
  deleteStoredImage,
  UPLOAD_DIR,
  MAX_BYTES,
};
