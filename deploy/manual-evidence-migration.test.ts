import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('reviewed ContentOS manual evidence release migration', () => {
  it('finishes schema validation before any candidate or active PM2 mutation', () => {
    const script = readFileSync(join(process.cwd(), 'deploy/deploy-release.sh'), 'utf8');
    const migration = script.indexOf('node --env-file="$runtime_env" "$release_dir/deploy/migrate-manual-evidence.mjs"');
    expect(migration).toBeGreaterThan(script.indexOf('tar -xzf'));
    expect(migration).toBeLessThan(script.indexOf('pm2 delete "$candidate_name"'));
    expect(migration).toBeLessThan(script.indexOf('start_release "$release_dir"'));
  });
});
