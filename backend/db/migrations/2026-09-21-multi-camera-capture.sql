-- ---------------------------------------------------------------------------
-- VETRI - Multi-camera capture upgrade
--
-- Manual equivalent of what `npm run db:migrate` applies via db/alterations.js.
-- Use this when you need to run the change by hand (a DBA-managed database, a
-- review before release, or a deployment where the Node migration is not run).
--
-- Running `npm run db:migrate` does all of this for you and is the normal path.
-- That runner is guarded by information_schema checks, so it is safe to re-run;
-- THIS FILE IS NOT. Run each section only if that section has not been applied
-- yet - the "check first" query above each one tells you.
--
-- Order matters: the status migration and the dedupe key both rebuild the same
-- unique index, so run the sections top to bottom.
--
-- Take a backup first:
--   mysqldump -u <user> -p <database> capture_sessions capture_devices captured_images > capture-backup.sql
-- ---------------------------------------------------------------------------

-- If the three capture tables do not exist at all, do NOT use this file -
-- run `npm run db:migrate`, which creates them from db/schema.sql already in
-- their final shape. Everything below upgrades tables created by an earlier
-- release.


-- ===========================================================================
-- 1. Near-identical duplicate detection: the 32x32 greyscale signature
-- ===========================================================================
-- Check first:
--   SELECT COLUMN_NAME FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'captured_images'
--      AND COLUMN_NAME = 'image_signature';

ALTER TABLE captured_images
  ADD COLUMN image_signature VARBINARY(1024) DEFAULT NULL AFTER perceptual_hash;


-- ===========================================================================
-- 2. Align the device/camera vocabulary
--      EXTERNAL       -> EXTERNAL_USB
--      BUILTIN_WEBCAM -> DESKTOP_WEBCAM
--      USB_EXTERNAL   -> USB_CAMERA
-- ===========================================================================
-- Check first:
--   SELECT COLUMN_TYPE FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'capture_devices'
--      AND COLUMN_NAME IN ('device_type', 'camera_type');
--   -- apply this section only while the old spellings are still listed.
--
-- Three steps per column, and the order is not optional: MySQL blanks any
-- value that does not fit the target ENUM, so the column has to accept BOTH
-- spellings while the rows are rewritten.

-- --- capture_devices.device_type -------------------------------------------
ALTER TABLE capture_devices MODIFY device_type
  ENUM('DESKTOP','MOBILE','TABLET','EXTERNAL','EXTERNAL_USB','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN';

UPDATE capture_devices SET device_type = 'EXTERNAL_USB' WHERE device_type = 'EXTERNAL';

ALTER TABLE capture_devices MODIFY device_type
  ENUM('DESKTOP','MOBILE','TABLET','EXTERNAL_USB','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN';

-- --- capture_devices.camera_type -------------------------------------------
ALTER TABLE capture_devices MODIFY camera_type
  ENUM('BUILTIN_WEBCAM','DESKTOP_WEBCAM','MOBILE_FRONT','MOBILE_REAR','USB_EXTERNAL','USB_CAMERA','UNKNOWN')
  NOT NULL DEFAULT 'UNKNOWN';

UPDATE capture_devices SET camera_type = 'DESKTOP_WEBCAM' WHERE camera_type = 'BUILTIN_WEBCAM';
UPDATE capture_devices SET camera_type = 'USB_CAMERA'     WHERE camera_type = 'USB_EXTERNAL';

ALTER TABLE capture_devices MODIFY camera_type
  ENUM('DESKTOP_WEBCAM','MOBILE_FRONT','MOBILE_REAR','USB_CAMERA','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN';

-- --- captured_images.device_type -------------------------------------------
ALTER TABLE captured_images MODIFY device_type
  ENUM('DESKTOP','MOBILE','TABLET','EXTERNAL','EXTERNAL_USB','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN';

UPDATE captured_images SET device_type = 'EXTERNAL_USB' WHERE device_type = 'EXTERNAL';

ALTER TABLE captured_images MODIFY device_type
  ENUM('DESKTOP','MOBILE','TABLET','EXTERNAL_USB','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN';

-- --- captured_images.camera_type -------------------------------------------
ALTER TABLE captured_images MODIFY camera_type
  ENUM('BUILTIN_WEBCAM','DESKTOP_WEBCAM','MOBILE_FRONT','MOBILE_REAR','USB_EXTERNAL','USB_CAMERA','UNKNOWN')
  NOT NULL DEFAULT 'UNKNOWN';

UPDATE captured_images SET camera_type = 'DESKTOP_WEBCAM' WHERE camera_type = 'BUILTIN_WEBCAM';
UPDATE captured_images SET camera_type = 'USB_CAMERA'     WHERE camera_type = 'USB_EXTERNAL';

ALTER TABLE captured_images MODIFY camera_type
  ENUM('DESKTOP_WEBCAM','MOBILE_FRONT','MOBILE_REAR','USB_CAMERA','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN';


-- ===========================================================================
-- 3. Hashed join token
-- ===========================================================================
-- SHA-256 of the current QR token. The raw token is never stored; rotating the
-- QR overwrites this digest, which invalidates every token issued before it.
--
-- Check first:
--   SELECT COLUMN_NAME FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'capture_sessions'
--      AND COLUMN_NAME = 'token_hash';

ALTER TABLE capture_sessions
  ADD COLUMN token_hash CHAR(64) DEFAULT NULL AFTER status;


-- ===========================================================================
-- 4. Image status vocabulary: STORED/ATTACHED/DISCARDED -> SUCCESS/DUPLICATE/FAILED
-- ===========================================================================
-- STORED and ATTACHED were both successful captures; DISCARDED was a failure.
-- DUPLICATE is new - an audit row for a rejected capture.
--
-- Check first:
--   SELECT COLUMN_TYPE FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'captured_images'
--      AND COLUMN_NAME = 'status';
--   -- apply only while 'STORED' is still listed.
--
-- The unique index is rebuilt on a generated column in section 7, so it is
-- dropped here first. Skip this DROP if the index does not exist yet.

ALTER TABLE captured_images DROP INDEX uq_captured_images_session_content;

ALTER TABLE captured_images MODIFY status
  ENUM('STORED','ATTACHED','DISCARDED','SUCCESS','DUPLICATE','FAILED') NOT NULL DEFAULT 'SUCCESS';

UPDATE captured_images SET status = 'SUCCESS' WHERE status IN ('STORED','ATTACHED');
UPDATE captured_images SET status = 'FAILED'  WHERE status = 'DISCARDED';

ALTER TABLE captured_images MODIFY status
  ENUM('SUCCESS','DUPLICATE','FAILED') NOT NULL DEFAULT 'SUCCESS';


-- ===========================================================================
-- 5. File columns must accept NULL
-- ===========================================================================
-- A DUPLICATE audit row records a rejection, and a rejected photo is never
-- written to disk - so it has no file to point at.
--
-- Check first:
--   SELECT COLUMN_NAME, IS_NULLABLE FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'captured_images'
--      AND COLUMN_NAME IN ('file_name','file_path','file_url');
--   -- apply only while IS_NULLABLE = 'NO'.

ALTER TABLE captured_images MODIFY file_name VARCHAR(255) DEFAULT NULL;
ALTER TABLE captured_images MODIFY file_path VARCHAR(500) DEFAULT NULL;
ALTER TABLE captured_images MODIFY file_url  VARCHAR(500) DEFAULT NULL;


-- ===========================================================================
-- 6. Duplicate audit trail
-- ===========================================================================
-- On a DUPLICATE row, `duplicate_of` holds the image_id of the capture it
-- repeats.
--
-- Check first:
--   SELECT COLUMN_NAME FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'captured_images'
--      AND COLUMN_NAME = 'duplicate_of';

ALTER TABLE captured_images
  ADD COLUMN duplicate_of CHAR(36) DEFAULT NULL AFTER status;

ALTER TABLE captured_images
  ADD KEY idx_captured_images_duplicate_of (duplicate_of);


-- ===========================================================================
-- 7. Race protection: unique key on a generated dedupe column
-- ===========================================================================
-- Only SUCCESS rows may collide - a DUPLICATE audit row deliberately repeats
-- an existing content_hash. MySQL has no partial indexes, so the unique key is
-- built on a generated column that is NULL for non-SUCCESS rows, and a unique
-- index permits repeated NULLs.
--
-- Check first:
--   SELECT COLUMN_NAME FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'captured_images'
--      AND COLUMN_NAME = 'dedupe_key';

ALTER TABLE captured_images
  ADD COLUMN dedupe_key CHAR(64)
  GENERATED ALWAYS AS (CASE WHEN status = 'SUCCESS' THEN content_hash ELSE NULL END) STORED;

-- Before adding the unique index, confirm nothing already violates it.
-- This MUST return zero rows; if it does not, remove the redundant rows first
-- (keep the earliest of each group) or the index will fail to build.
--
--   SELECT session_id, dedupe_key, COUNT(*) AS copies
--     FROM captured_images
--    WHERE session_id IS NOT NULL AND dedupe_key IS NOT NULL
--    GROUP BY session_id, dedupe_key
--   HAVING copies > 1;

ALTER TABLE captured_images
  ADD UNIQUE KEY uq_captured_images_session_content (session_id, dedupe_key);


-- ===========================================================================
-- Verification
-- ===========================================================================
-- Every one of these should come back as described.

-- a) New columns are present.
--   SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
--     FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE()
--      AND ((TABLE_NAME = 'captured_images'
--            AND COLUMN_NAME IN ('image_signature','status','duplicate_of','dedupe_key',
--                                'file_name','file_path','file_url'))
--        OR (TABLE_NAME = 'capture_sessions' AND COLUMN_NAME = 'token_hash'));

-- b) No old enum spellings survive anywhere (expect 0).
--   SELECT COUNT(*) FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE()
--      AND TABLE_NAME IN ('capture_devices','captured_images')
--      AND COLUMN_NAME IN ('device_type','camera_type')
--      AND (COLUMN_TYPE LIKE '%EXTERNAL''%' OR COLUMN_TYPE LIKE '%BUILTIN_WEBCAM%'
--           OR COLUMN_TYPE LIKE '%USB_EXTERNAL%');

-- c) The unique index exists on (session_id, dedupe_key).
--   SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols, NON_UNIQUE
--     FROM information_schema.STATISTICS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'captured_images'
--      AND INDEX_NAME = 'uq_captured_images_session_content'
--    GROUP BY INDEX_NAME, NON_UNIQUE;

-- d) No rows were stranded by the status migration (expect 0).
--   SELECT COUNT(*) FROM captured_images WHERE status NOT IN ('SUCCESS','DUPLICATE','FAILED');
