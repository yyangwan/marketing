import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mariadb from 'mariadb';
import { migrate } from './migrate-manual-evidence.mjs';

// Explicit local-only test connection. Never load application .env files.
const url = new URL(process.env.CONTENTOS_MIGRATION_TEST_URL || 'mysql://missing@127.0.0.1:1/missing');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/contentos_migration_ci') throw new Error('isolated_test_database_required');
const config = { host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: 'contentos_migration_ci', multipleStatements: false, allowPublicKeyRetrieval: true };
const db = await mariadb.createConnection(config);
const sql = await readFile(new URL('../prisma/manual-evidence-tasks.sql', import.meta.url), 'utf8');
const statements = sql.replace(/--[^\n]*/g, '').split(';').map(value => value.trim()).filter(Boolean);
async function clear() {
  await db.query('DROP TABLE IF EXISTS ManualEvidenceTaskEvent');
  await db.query('DROP TABLE IF EXISTS ManualEvidenceTask');
}
try {
  await clear();
  await db.query('CREATE TABLE IF NOT EXISTS migration_preservation_probe (id INT PRIMARY KEY, value VARCHAR(32))');
  await db.query("INSERT INTO migration_preservation_probe VALUES (1, 'preserved') ON DUPLICATE KEY UPDATE value='preserved'");
  await migrate(db, sql);
  await db.query("INSERT INTO ManualEvidenceTask (id,workspaceId,projectId,approvalId,briefSnapshot,snapshotHash,createdByUserId,updatedAt) VALUES ('task','ws','project','approval','{}',REPEAT('a',64),'user',NOW(3))");
  await migrate(db, sql);
  assert.equal((await db.query('SELECT COUNT(*) AS count FROM ManualEvidenceTask'))[0].count, 1n);
  assert.equal((await db.query('SELECT value FROM migration_preservation_probe WHERE id=1'))[0].value, 'preserved');
  await assert.rejects(db.query("INSERT INTO ManualEvidenceTaskEvent (id,taskId,version,action,actorId,reason,idempotencyKey,requestHash,responseSnapshot) VALUES ('orphan','absent',1,'created','user','reason','key',REPEAT('a',64),'{}')"));
  await clear();
  // Recovery after first CREATE, then after both CREATEs but before the FK.
  await db.query(statements[0]);
  await migrate(db, sql);
  await clear();
  await db.query(statements[0]);
  await db.query(statements[1]);
  await migrate(db, sql);
  await clear();
  await db.query(statements[0]);
  await db.query('ALTER TABLE ManualEvidenceTask MODIFY snapshotHash VARCHAR(32) NOT NULL');
  await assert.rejects(migrate(db, sql), /schema_mismatch/);
  assert.equal((await db.query("SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ManualEvidenceTaskEvent'"))[0].count, 0n);
  await clear();
  await migrate(db, sql);
  await db.query('ALTER TABLE ManualEvidenceTaskEvent DROP FOREIGN KEY ManualEvidenceTaskEvent_taskId_fkey');
  await db.query('ALTER TABLE ManualEvidenceTaskEvent ADD CONSTRAINT ManualEvidenceTaskEvent_taskId_fkey FOREIGN KEY (taskId) REFERENCES ManualEvidenceTask(id) ON DELETE CASCADE ON UPDATE CASCADE');
  await assert.rejects(migrate(db, sql), /schema_mismatch/);
  console.log('manual_evidence_mysql_acceptance_passed: fresh, repeat, preservation, FK, partial DDL recovery, incompatible column/FK rejection');
} finally { await clear(); await db.query('DROP TABLE IF EXISTS migration_preservation_probe'); await db.end(); }
