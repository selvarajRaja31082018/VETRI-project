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

async function applyAlterations(connection, database) {
  const applied = [];

  if (!(await tableExists(connection, database, 'captured_images'))) return applied;

  // Signature used for near-identical duplicate detection.
  if (!(await columnExists(connection, database, 'captured_images', 'image_signature'))) {
    await connection.query(
      `ALTER TABLE captured_images
         ADD COLUMN image_signature VARBINARY(1024) DEFAULT NULL AFTER perceptual_hash`,
    );
    applied.push('captured_images.image_signature added');
  }

  // Race protection for simultaneous submissions of identical bytes.
  if (!(await indexExists(connection, database, 'captured_images', 'uq_captured_images_session_content'))) {
    const [clashes] = await connection.query(
      `SELECT session_id, content_hash, COUNT(*) AS copies
         FROM captured_images
        WHERE session_id IS NOT NULL
        GROUP BY session_id, content_hash
       HAVING copies > 1`,
    );

    if (clashes.length) {
      // Pre-existing duplicates would make the unique index fail to build.
      // Report rather than delete - removing rows is the operator's call.
      console.warn(
        `Skipped unique index uq_captured_images_session_content: ${clashes.length} ` +
          'existing (session_id, content_hash) group(s) already hold duplicates. ' +
          'Remove the redundant captured_images rows, then re-run the migration.',
      );
    } else {
      await connection.query(
        `ALTER TABLE captured_images
           ADD UNIQUE KEY uq_captured_images_session_content (session_id, content_hash)`,
      );
      applied.push('captured_images unique (session_id, content_hash) added');
    }
  }

  return applied;
}

module.exports = { applyAlterations };
