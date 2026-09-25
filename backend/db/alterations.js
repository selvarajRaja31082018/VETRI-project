'use strict';

/**
 * Idempotent ALTERs for tables that already exist.
 *
 * `schema.sql` is all `CREATE TABLE IF NOT EXISTS`, so it silently does nothing
 * to a table that was created by an earlier release. Anything that changes an
 * existing table has to live here, guarded by an information_schema check so it
 * is safe to run on every migration.
 */

async function columnExists(connection, database, table, column) {
  const [rows] = await connection.query(
    `SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [database, table, column],
  );
  return rows.length > 0;
}

async function columnType(connection, database, table, column) {
  const [rows] = await connection.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [database, table, column],
  );
  return rows.length ? rows[0].COLUMN_TYPE : null;
}

async function indexExists(connection, database, table, index) {
  const [rows] = await connection.query(
    `SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [database, table, index],
  );
  return rows.length > 0;
}

async function tableExists(connection, database, table) {
  const [rows] = await connection.query(
    `SELECT 1 FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    [database, table],
  );
  return rows.length > 0;
}

const DEVICE_ENUM_FINAL = "ENUM('DESKTOP','MOBILE','TABLET','EXTERNAL_USB','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN'";
const DEVICE_ENUM_WIDE =
  "ENUM('DESKTOP','MOBILE','TABLET','EXTERNAL','EXTERNAL_USB','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN'";
const CAMERA_ENUM_FINAL =
  "ENUM('DESKTOP_WEBCAM','MOBILE_FRONT','MOBILE_REAR','USB_CAMERA','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN'";
const CAMERA_ENUM_WIDE =
  "ENUM('BUILTIN_WEBCAM','DESKTOP_WEBCAM','MOBILE_FRONT','MOBILE_REAR','USB_EXTERNAL','USB_CAMERA','UNKNOWN') " +
  "NOT NULL DEFAULT 'UNKNOWN'";

/**
 * Rename enum members in place: widen the column to accept both spellings,
 * rewrite the rows, then narrow it to the final set. Doing it in one step is
 * not possible - MySQL would silently blank values that no longer fit.
 */
async function alignEnums(connection, database, table, applied) {
  if (!(await tableExists(connection, database, table))) return;

  const deviceType = await columnType(connection, database, table, 'device_type');
  if (deviceType && deviceType.includes("'EXTERNAL'")) {
    await connection.query(`ALTER TABLE \`${table}\` MODIFY device_type ${DEVICE_ENUM_WIDE}`);
    await connection.query(`UPDATE \`${table}\` SET device_type = 'EXTERNAL_USB' WHERE device_type = 'EXTERNAL'`);
    await connection.query(`ALTER TABLE \`${table}\` MODIFY device_type ${DEVICE_ENUM_FINAL}`);
    applied.push(`${table}.device_type: EXTERNAL -> EXTERNAL_USB`);
  }

  const cameraType = await columnType(connection, database, table, 'camera_type');
  if (cameraType && (cameraType.includes("'BUILTIN_WEBCAM'") || cameraType.includes("'USB_EXTERNAL'"))) {
    await connection.query(`ALTER TABLE \`${table}\` MODIFY camera_type ${CAMERA_ENUM_WIDE}`);
    await connection.query(
      `UPDATE \`${table}\` SET camera_type = 'DESKTOP_WEBCAM' WHERE camera_type = 'BUILTIN_WEBCAM'`,
    );
    await connection.query(`UPDATE \`${table}\` SET camera_type = 'USB_CAMERA' WHERE camera_type = 'USB_EXTERNAL'`);
    await connection.query(`ALTER TABLE \`${table}\` MODIFY camera_type ${CAMERA_ENUM_FINAL}`);
    applied.push(`${table}.camera_type: BUILTIN_WEBCAM/USB_EXTERNAL -> DESKTOP_WEBCAM/USB_CAMERA`);
  }
}

async function applyAlterations(connection, database) {
  const applied = [];

  // Optional visitor email, used to send the visitor pass.
  if (
    (await tableExists(connection, database, 'visitors')) &&
    !(await columnExists(connection, database, 'visitors', 'email'))
  ) {
    await connection.query('ALTER TABLE visitors ADD COLUMN email VARCHAR(255) DEFAULT NULL AFTER mobile');
    applied.push('visitors.email added');
  }

  if (!(await tableExists(connection, database, 'captured_images'))) return applied;

  // Signature used for near-identical duplicate detection.
  if (!(await columnExists(connection, database, 'captured_images', 'image_signature'))) {
    await connection.query(
      `ALTER TABLE captured_images
         ADD COLUMN image_signature VARBINARY(1024) DEFAULT NULL AFTER perceptual_hash`,
    );
    applied.push('captured_images.image_signature added');
  }

  await alignEnums(connection, database, 'capture_devices', applied);
  await alignEnums(connection, database, 'captured_images', applied);

  // Hashed join token, so rotating the QR invalidates every earlier token.
  if (
    (await tableExists(connection, database, 'capture_sessions')) &&
    !(await columnExists(connection, database, 'capture_sessions', 'token_hash'))
  ) {
    await connection.query('ALTER TABLE capture_sessions ADD COLUMN token_hash CHAR(64) DEFAULT NULL AFTER status');
    applied.push('capture_sessions.token_hash added');
  }

  // Image status vocabulary: STORED/ATTACHED were both successful captures,
  // DISCARDED was a failure. DUPLICATE is new - an audit row for a rejection.
  const imageStatus = await columnType(connection, database, 'captured_images', 'status');
  if (imageStatus && imageStatus.includes("'STORED'")) {
    if (await indexExists(connection, database, 'captured_images', 'uq_captured_images_session_content')) {
      await connection.query('ALTER TABLE captured_images DROP INDEX uq_captured_images_session_content');
    }
    await connection.query(
      `ALTER TABLE captured_images MODIFY status
         ENUM('STORED','ATTACHED','DISCARDED','SUCCESS','DUPLICATE','FAILED') NOT NULL DEFAULT 'SUCCESS'`,
    );
    await connection.query("UPDATE captured_images SET status = 'SUCCESS' WHERE status IN ('STORED','ATTACHED')");
    await connection.query("UPDATE captured_images SET status = 'FAILED' WHERE status = 'DISCARDED'");
    await connection.query(
      "ALTER TABLE captured_images MODIFY status ENUM('SUCCESS','DUPLICATE','FAILED') NOT NULL DEFAULT 'SUCCESS'",
    );
    applied.push('captured_images.status -> SUCCESS/DUPLICATE/FAILED');
  }

  /*
   * A DUPLICATE audit row records a rejection, and a rejected photo is never
   * written to disk - so the file columns must accept NULL.
   */
  const fileNameType = await columnType(connection, database, 'captured_images', 'file_name');
  if (fileNameType) {
    const [[{ nullable }]] = await connection.query(
      `SELECT IS_NULLABLE AS nullable FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'captured_images' AND COLUMN_NAME = 'file_name'`,
      [database],
    );
    if (nullable === 'NO') {
      await connection.query('ALTER TABLE captured_images MODIFY file_name VARCHAR(255) DEFAULT NULL');
      await connection.query('ALTER TABLE captured_images MODIFY file_path VARCHAR(500) DEFAULT NULL');
      await connection.query('ALTER TABLE captured_images MODIFY file_url VARCHAR(500) DEFAULT NULL');
      applied.push('captured_images file columns made nullable for duplicate audit rows');
    }
  }

  if (!(await columnExists(connection, database, 'captured_images', 'duplicate_of'))) {
    await connection.query('ALTER TABLE captured_images ADD COLUMN duplicate_of CHAR(36) DEFAULT NULL AFTER status');
    await connection.query('ALTER TABLE captured_images ADD KEY idx_captured_images_duplicate_of (duplicate_of)');
    applied.push('captured_images.duplicate_of added');
  }

  /*
   * Race protection. Only SUCCESS rows may collide: a DUPLICATE audit row
   * deliberately repeats an existing content_hash. MySQL has no partial
   * indexes, so the unique key is built on a generated column that is NULL for
   * non-SUCCESS rows - and a unique index permits repeated NULLs.
   */
  if (!(await columnExists(connection, database, 'captured_images', 'dedupe_key'))) {
    if (await indexExists(connection, database, 'captured_images', 'uq_captured_images_session_content')) {
      await connection.query('ALTER TABLE captured_images DROP INDEX uq_captured_images_session_content');
    }
    await connection.query(
      `ALTER TABLE captured_images ADD COLUMN dedupe_key CHAR(64)
         GENERATED ALWAYS AS (CASE WHEN status = 'SUCCESS' THEN content_hash ELSE NULL END) STORED`,
    );
    applied.push('captured_images.dedupe_key added');
  }

  if (!(await indexExists(connection, database, 'captured_images', 'uq_captured_images_session_content'))) {
    const [clashes] = await connection.query(
      `SELECT session_id, dedupe_key, COUNT(*) AS copies
         FROM captured_images
        WHERE session_id IS NOT NULL AND dedupe_key IS NOT NULL
        GROUP BY session_id, dedupe_key
       HAVING copies > 1`,
    );

    if (clashes.length) {
      // Pre-existing duplicates would make the unique index fail to build.
      // Report rather than delete - removing rows is the operator's call.
      console.warn(
        `Skipped unique index uq_captured_images_session_content: ${clashes.length} ` +
          'existing (session_id, content_hash) group(s) already hold duplicate SUCCESS rows. ' +
          'Remove the redundant captured_images rows, then re-run the migration.',
      );
    } else {
      await connection.query(
        'ALTER TABLE captured_images ADD UNIQUE KEY uq_captured_images_session_content (session_id, dedupe_key)',
      );
      applied.push('captured_images unique (session_id, dedupe_key) added');
    }
  }

  return applied;
}

module.exports = { applyAlterations };
