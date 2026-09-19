'use strict';

const crypto = require('crypto');
const sharp = require('sharp');
const logger = require('./logger');

/**
 * Duplicate-photo detection.
 *
 * Everything here runs on the SERVER, on the decoded pixels of the uploaded
 * image. Nothing the client sends influences the verdict.
 *
 * Two measures, in order:
 *
 *  1. `contentHash` - SHA-256 of the decoded bytes. Catches a byte-identical
 *     re-submission (a retried request, a replayed capture, two devices posting
 *     the same file).
 *
 *  2. `signature` + RMSE - a 32x32 greyscale thumbnail of the image. Two
 *     photographs are the same shot when their thumbnails differ by almost
 *     nothing; re-encoding, a quality change or a resize moves this by well
 *     under a grey level, while a genuinely different frame moves it several.
 *
 * WHY NOT A PERCEPTUAL HASH ALONE
 * -------------------------------
 * A dHash describes only coarse structure, and every photo taken at the same
 * desk shares that structure - same person, same chair, same wall. Measured on
 * representative frames, a re-encoded duplicate scores a dHash distance of 0-5
 * while a genuinely different photo of the SAME person scores as low as 3. The
 * two ranges overlap, so no dHash threshold can separate them: that is exactly
 * why "same person, new photo" was being rejected. The dHash is still computed
 * and stored (it is a cheap, indexable fingerprint), but it does NOT decide
 * anything.
 *
 * The RMSE of the 32x32 signature does separate them cleanly - a re-encoded or
 * resized duplicate stays under ~1.4, while moving the subject by as little as
 * two pixels, or an exposure shift, lands above ~3.2.
 *
 * WHAT THIS DELIBERATELY IS NOT
 * -----------------------------
 * This is image comparison, not face recognition. The same person photographed
 * twice produces two different images and is saved twice. Identity fields
 * (visitor, member, name, mobile, device, session) never take part in the
 * comparison.
 */

/** Greyscale grid used for the similarity signature. 32x32 = 1024 bytes. */
const SIGNATURE_SIZE = 32;
const SIGNATURE_BYTES = SIGNATURE_SIZE * SIGNATURE_SIZE;

/** dHash grid: 9 wide so 8 horizontal comparisons per row give 64 bits. */
const DHASH_WIDTH = 9;
const DHASH_HEIGHT = 8;

const PHASH_PATTERN = /^[0-9a-f]{16}$/;

/** SHA-256 of the raw image bytes, as lowercase hex. */
function contentHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Decode the image once and derive every fingerprint from the pixels.
 *
 * A file that cannot be decoded still yields a `contentHash`, so an exact
 * duplicate is caught even when the perceptual measures are unavailable;
 * `signature` is then null and the near-identical check is skipped rather than
 * guessed at.
 */
async function analyseImage(buffer) {
  const result = {
    contentHash: contentHash(buffer),
    perceptualHash: null,
    signature: null,
    width: null,
    height: null,
  };

  try {
    // `failOn: 'none'` keeps a slightly truncated capture from throwing - a
    // partially decoded frame still fingerprints usefully.
    const metadata = await sharp(buffer, { failOn: 'none' }).metadata();
    result.width = metadata.width || null;
    result.height = metadata.height || null;

    // `fit: 'fill'` ignores aspect ratio on purpose, so the same photo stored
    // at two aspect ratios still lines up cell for cell.
    const [dhashPixels, signature] = await Promise.all([
      sharp(buffer, { failOn: 'none' })
        .greyscale()
        .resize(DHASH_WIDTH, DHASH_HEIGHT, { fit: 'fill' })
        .raw()
        .toBuffer(),
      sharp(buffer, { failOn: 'none' })
        .greyscale()
        .resize(SIGNATURE_SIZE, SIGNATURE_SIZE, { fit: 'fill' })
        .raw()
        .toBuffer(),
    ]);

    result.perceptualHash = buildDhash(dhashPixels);
    result.signature = signature.length === SIGNATURE_BYTES ? signature : null;
  } catch (error) {
    // Never fail an upload because fingerprinting failed; degrade to the
    // exact-match check and say so in the log.
    logger.warn('Could not derive perceptual fingerprints for a capture', error.message);
  }

  return result;
}

/** 64-bit difference hash from a 9x8 greyscale buffer, as 16 hex characters. */
function buildDhash(pixels) {
  if (!pixels || pixels.length < DHASH_WIDTH * DHASH_HEIGHT) return null;

  let hash = '';
  let nibble = 0;
  let bits = 0;

  for (let y = 0; y < DHASH_HEIGHT; y += 1) {
    for (let x = 0; x < DHASH_WIDTH - 1; x += 1) {
      const index = y * DHASH_WIDTH + x;
      nibble = (nibble << 1) | (pixels[index] > pixels[index + 1] ? 1 : 0);
      bits += 1;
      if (bits === 4) {
        hash += nibble.toString(16);
        nibble = 0;
        bits = 0;
      }
    }
  }

  return hash.length === 16 ? hash : null;
}

/** Normalise a stored/blob signature to a comparable Buffer, or null. */
function toSignatureBuffer(value) {
  if (!value) return null;
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buffer.length === SIGNATURE_BYTES ? buffer : null;
}

/**
 * Root-mean-square difference between two signatures, in grey levels (0-255).
 * `null` when either signature is missing or the wrong size, so callers skip
 * the comparison instead of treating "unknown" as "identical".
 */
function signatureDistance(a, b) {
  const left = toSignatureBuffer(a);
  const right = toSignatureBuffer(b);
  if (!left || !right) return null;

  let total = 0;
  for (let i = 0; i < SIGNATURE_BYTES; i += 1) {
    const delta = left[i] - right[i];
    total += delta * delta;
  }
  return Math.sqrt(total / SIGNATURE_BYTES);
}

/** Validate a 16-hex-character dHash. */
function normalisePerceptualHash(value) {
  if (typeof value !== 'string') return null;
  const normalised = value.trim().toLowerCase();
  return PHASH_PATTERN.test(normalised) ? normalised : null;
}

/** Differing bits between two 16-char hex dHashes (0-64), or null. Reported
 *  for diagnostics only - it never decides whether a photo is a duplicate. */
function hammingDistance(hexA, hexB) {
  const a = normalisePerceptualHash(hexA);
  const b = normalisePerceptualHash(hexB);
  if (!a || !b) return null;

  let distance = 0;
  for (let i = 0; i < 16; i += 2) {
    let xor = parseInt(a.slice(i, i + 2), 16) ^ parseInt(b.slice(i, i + 2), 16);
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

module.exports = {
  contentHash,
  analyseImage,
  signatureDistance,
  normalisePerceptualHash,
  hammingDistance,
  SIGNATURE_SIZE,
  SIGNATURE_BYTES,
};
