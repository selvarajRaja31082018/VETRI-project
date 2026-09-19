/**
 * Perceptual hashing for duplicate-capture detection.
 *
 * The backend rejects byte-identical re-uploads on its own (SHA-256 of the
 * decoded bytes). That misses the common case though: the operator snaps the
 * *same* shot twice, and JPEG re-encoding makes the two files differ by a few
 * bytes. A dHash catches that - it describes what the picture looks like rather
 * than how it was encoded, so it survives re-encoding, resizing and small
 * brightness shifts while still changing sharply when the subject changes.
 *
 * Computed here rather than on the server because decoding JPEG/PNG in Node
 * needs a native image library; the canvas frame is already decoded in the
 * browser. The server treats the result as a hint that can only *reject* a
 * capture, never as proof that one is allowed through.
 */

/** Width is 9 so 8 horizontal comparisons per row yield exactly 64 bits. */
const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;

/**
 * 64-bit difference hash of a canvas frame, as 16 lowercase hex characters.
 * Returns `null` if the frame cannot be read (a tainted canvas, or a video that
 * has not produced a frame yet) - callers then fall back to the server's
 * exact-match check alone.
 */
export function computePerceptualHash(source: HTMLCanvasElement | HTMLImageElement): string | null {
  try {
    const scratch = document.createElement('canvas');
    scratch.width = HASH_WIDTH;
    scratch.height = HASH_HEIGHT;

    const ctx = scratch.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // The browser's own downscaler does the low-pass filtering for us, which is
    // what makes the hash stable across resolutions.
    ctx.drawImage(source, 0, 0, HASH_WIDTH, HASH_HEIGHT);
    const { data } = ctx.getImageData(0, 0, HASH_WIDTH, HASH_HEIGHT);

    // Rec. 601 luma - matches what a human reads as brightness.
    const grey = new Array<number>(HASH_WIDTH * HASH_HEIGHT);
    for (let i = 0; i < grey.length; i += 1) {
      const p = i * 4;
      grey[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    }

    let hash = '';
    let nibble = 0;
    let bitsInNibble = 0;

    for (let y = 0; y < HASH_HEIGHT; y += 1) {
      for (let x = 0; x < HASH_WIDTH - 1; x += 1) {
        const index = y * HASH_WIDTH + x;
        const bit = grey[index] > grey[index + 1] ? 1 : 0;
        nibble = (nibble << 1) | bit;
        bitsInNibble += 1;
        if (bitsInNibble === 4) {
          hash += nibble.toString(16);
          nibble = 0;
          bitsInNibble = 0;
        }
      }
    }

    return hash.length === 16 ? hash : null;
  } catch {
    return null;
  }
}
