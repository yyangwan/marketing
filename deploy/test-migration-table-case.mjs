import assert from 'node:assert/strict';
import { validateKeys } from './migrate-manual-evidence.mjs';

const key = {
  TABLE_NAME: 'ManualEvidenceTaskEvent', CONSTRAINT_NAME: 'ManualEvidenceTaskEvent_taskId_fkey',
  COLUMN_NAME: 'taskId', REFERENCED_TABLE_SCHEMA: 'contentos', REFERENCED_TABLE_NAME: 'ManualEvidenceTask',
  REFERENCED_COLUMN_NAME: 'id', DELETE_RULE: 'RESTRICT', UPDATE_RULE: 'CASCADE',
};
const folded = { ...key, TABLE_NAME: key.TABLE_NAME.toLowerCase(), REFERENCED_TABLE_NAME: key.REFERENCED_TABLE_NAME.toLowerCase() };
validateKeys([key], 'contentos', 0);
assert.throws(() => validateKeys([folded], 'contentos', 0), /schema_mismatch/);
for (const mode of [1, 2]) {
  validateKeys([folded], 'contentos', mode);
  for (const invalid of [{ REFERENCED_TABLE_NAME: 'OtherTask' }, { DELETE_RULE: 'CASCADE' }, { REFERENCED_TABLE_SCHEMA: 'other' }, { COLUMN_NAME: 'TaskId' }]) {
    assert.throws(() => validateKeys([{ ...folded, ...invalid }], 'contentos', mode), /schema_mismatch/);
  }
}
console.log('migration_table_case_checks_passed');
