'use strict';

const crypto = require('crypto');

/**
 * Duplicate detection works on two hashes:
 *
 *  - `content_hash` - SHA-256 of the decoded bytes, computed here on the server.
 *    Catches a byte-identical re-submission (the same frame posted twice, a
 *    retried request, a device replaying an old capture).
 *
 *  - `perceptual_hash` - a 64-bit dHash computed in the browser from the canvas
 *    frame (see frontend/src/utils/imageHash.ts) and sent alongside the upload.
 *    Catches "the same photo again" after re-encoding, mild resizing or JPEG
 *    quality changes, which a byte hash cannot.
 *
 * The perceptual hash is client-supplied, so it is treated as a *hint*, never as
 * a security control: it can only cause a capture to be rejected as a duplicate,
 * never to bypass a check. The authoritative exact-match check always runs on
 * the server. Decoding JPEG/PNG server-side to recompute the dHash would need a
 * native image library (sharp/jimp); that can be dropped in later behind
 * `computePerceptualHash()` without changing any caller.
 */

const PHASH_PATTERN = /^[0-9a-f]{16}$/;

/** SHA-256 of the raw image bytes, as lowercase hex. */
function contentHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/** Accept a client-supplied dHash only if it is exactly 16 lowercase hex chars. */
function normalisePerceptualHash(value) {
  if (typeof value !== 'string') return null;
  const normalised = value.trim().toLowerCase();
  return PHASH_PATTERN.test(normalised) ? normalised : null;
}

/**
 * Number of differing bits between two 16-char hex dHashes (0-64).
 * Returns `null` when either hash is missing, so callers can skip the
 * near-duplicate check rather than treat "unknown" as "different".
 */
function hammingDistance(hexA, hexB) {
  const a = normalisePerceptualHash(hexA);
  const b = normalisePerceptualHash(hexB);
  if (!a || !b) return null;
  if (a === b) return 0;

  let distance = 0;
  // Compare in 8 byte-sized chunks; BigInt would work but is markedly slower
  // and this runs once per candidate row.
  for (let i = 0; i < 16; i += 2) {
    let xor = parseInt(a.slice(i, i + 2), 16) ^ parseInt(b.slice(i, i + 2), 16);
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

module.exports = { contentHash, normalisePerceptualHash, hammingDistance };
