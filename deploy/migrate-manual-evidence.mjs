import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import mariadb from 'mariadb';

const task = 'ManualEvidenceTask';
const event = 'ManualEvidenceTaskEvent';
const column = (type, nullable = false, defaultValue = null) => ({ type, nullable, defaultValue });
const expected = {
  [task]: {
    id: column('varchar(32)'), workspaceId: column('varchar(191)'), projectId: column('varchar(191)'),
    approvalId: column('varchar(32)'), briefSnapshot: column('mediumtext'), snapshotHash: column('varchar(64)'),
    createdByUserId: column('varchar(191)'), ownerUserId: column('varchar(191)', true),
    status: column('varchar(32)', false, 'pending'), version: column('int', false, '1'),
    deliveryUrl: column('text', true), completionNotes: column('text', true),
    createdAt: column('datetime(3)', false, 'current_timestamp(3)'), updatedAt: column('datetime(3)'),
  },
  [event]: {
    id: column('varchar(191)'), taskId: column('varchar(32)'), version: column('int'),
    action: column('varchar(32)'), actorId: column('varchar(191)'), reason: column('text'),
    deliveryUrl: column('text', true), idempotencyKey: column('varchar(100)'), requestHash: column('varchar(64)'),
    responseSnapshot: column('mediumtext'), createdAt: column('datetime(3)', false, 'current_timestamp(3)'),
  },
};
const indexes = {
  [task]: { PRIMARY: [0, 'id'], ManualEvidenceTask_workspaceId_projectId_createdAt_idx: [1, 'workspaceId,projectId,createdAt'], ManualEvidenceTask_workspaceId_projectId_approvalId_key: [0, 'workspaceId,projectId,approvalId'] },
  [event]: { PRIMARY: [0, 'id'], ManualEvidenceTaskEvent_taskId_version_key: [0, 'taskId,version'], ManualEvidenceTaskEvent_taskId_idempotencyKey_key: [0, 'taskId,idempotencyKey'] },
};
function fail() { throw new Error('manual_evidence_schema_mismatch'); }
const normalizeType = value => String(value).toLowerCase().replace(/^int\(\d+\)$/, 'int');
const normalizeDefault = value => value === null ? null : String(value).replace(/^'(.*)'$/, '$1').toLowerCase();

async function validateTable(db, name) {
  const tables = await db.query('SELECT ENGINE, TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [name]);
  if (!tables.length) return false;
  if (tables[0].ENGINE !== 'InnoDB' || tables[0].TABLE_COLLATION !== 'utf8mb4_unicode_ci') fail();
  const columns = await db.query('SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [name]);
  if (columns.length !== Object.keys(expected[name]).length) fail();
  for (const row of columns) {
    const spec = expected[name][row.COLUMN_NAME];
    if (!spec || normalizeType(row.COLUMN_TYPE) !== spec.type || (row.IS_NULLABLE === 'YES') !== spec.nullable || normalizeDefault(row.COLUMN_DEFAULT) !== spec.defaultValue || !['', 'DEFAULT_GENERATED'].includes(row.EXTRA) || row.COLLATION_NAME && row.COLLATION_NAME !== 'utf8mb4_unicode_ci') fail();
  }
  const rows = await db.query('SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX, SUB_PART, INDEX_TYPE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY INDEX_NAME, SEQ_IN_INDEX', [name]);
  const actual = {};
  for (const row of rows) {
    if (row.SUB_PART !== null || row.INDEX_TYPE !== 'BTREE') fail();
    (actual[row.INDEX_NAME] ||= [Number(row.NON_UNIQUE), []])[1].push(row.COLUMN_NAME);
  }
  if (Object.keys(actual).length !== Object.keys(indexes[name]).length) fail();
  for (const [key, [unique, names]] of Object.entries(indexes[name])) {
    if (!actual[key] || actual[key][0] !== unique || actual[key][1].join(',') !== names) fail();
  }
  return true;
}

async function foreignKeys(db) {
  return db.query(`SELECT k.TABLE_NAME, k.CONSTRAINT_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_SCHEMA,
    k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME, r.DELETE_RULE, r.UPDATE_RULE
    FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r
    ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME AND r.TABLE_NAME=k.TABLE_NAME
    WHERE k.TABLE_SCHEMA=DATABASE() AND k.TABLE_NAME IN (?, ?)`, [task, event]);
}
function validateKeys(rows, schema) {
  if (rows.length !== 1) fail();
  const row = rows[0];
  if (row.TABLE_NAME !== event || row.CONSTRAINT_NAME !== 'ManualEvidenceTaskEvent_taskId_fkey' || row.COLUMN_NAME !== 'taskId' || row.REFERENCED_TABLE_SCHEMA !== schema || row.REFERENCED_TABLE_NAME !== task || row.REFERENCED_COLUMN_NAME !== 'id' || row.DELETE_RULE !== 'RESTRICT' || row.UPDATE_RULE !== 'CASCADE') fail();
}

export async function migrate(db, sql) {
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map(value => value.trim()).filter(Boolean);
  if (statements.length !== 3 || !statements[0].startsWith('CREATE TABLE `ManualEvidenceTask` (') || !statements[1].startsWith('CREATE TABLE `ManualEvidenceTaskEvent` (') || !statements[2].startsWith('ALTER TABLE `ManualEvidenceTaskEvent` ADD CONSTRAINT `ManualEvidenceTaskEvent_taskId_fkey` FOREIGN KEY')) throw new Error('manual_evidence_ddl_invalid');
  const schema = (await db.query('SELECT DATABASE() AS name'))[0].name;
  if (!schema) throw new Error('manual_evidence_database_required');
  const lock = `contentos-manual-evidence:${schema}`.slice(0, 64);
  if (Number((await db.query('SELECT GET_LOCK(?, 30) AS acquired', [lock]))[0].acquired) !== 1) throw new Error('manual_evidence_lock_unavailable');
  try {
    // Validate every existing table before making any change. A crash after either
    // CREATE or ALTER is recovered by inspecting actual schema on the next run.
    const exists = {};
    for (const name of [task, event]) exists[name] = await validateTable(db, name);
    const keys = await foreignKeys(db);
    if (keys.length) validateKeys(keys, schema);
    for (const [index, name] of [task, event].entries()) {
      if (!exists[name]) await db.query(statements[index]);
      await validateTable(db, name);
    }
    if (!keys.length) await db.query(statements[2]);
    validateKeys(await foreignKeys(db), schema);
  } finally { await db.query('SELECT RELEASE_LOCK(?)', [lock]); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--check-runtime')) console.log('manual_evidence_runtime_ok');
  else {
    let db;
    try {
      if (!process.env.DATABASE_URL) throw new Error('database_required');
      const url = new URL(process.env.DATABASE_URL);
      if (!['mysql:', 'mariadb:'].includes(url.protocol) || url.search) throw new Error('database_url_unsupported');
      db = await mariadb.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: decodeURIComponent(url.pathname.slice(1)), connectTimeout: 10000, socketTimeout: 60000, multipleStatements: false, allowPublicKeyRetrieval: ['127.0.0.1', 'localhost'].includes(url.hostname) });
      await migrate(db, await readFile(new URL('./manual-evidence-tasks.sql', import.meta.url), 'utf8'));
      console.log('manual_evidence_migration_verified');
    } catch { console.error('manual_evidence_migration_failed; active release unchanged'); process.exitCode = 1; }
    finally { if (db) await db.end(); }
  }
}
