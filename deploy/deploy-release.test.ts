import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("ContentOS release deployment", () => {
  const script = readFileSync(join(process.cwd(), "deploy", "deploy-release.sh"), "utf8");

  it("recreates the active PM2 process so its script path changes with each release", () => {
    const deleteIndex = script.indexOf('pm2 delete "$active_name"');
    const startIndex = script.indexOf('pm2 start "$release_config"');

    expect(deleteIndex).toBeGreaterThan(-1);
    expect(startIndex).toBeGreaterThan(deleteIndex);
    expect(script).not.toContain('pm2 startOrReload "$release_config"');
  });

  it("requires the active process working directory to match the target release", () => {
    expect(script).toContain('active_cwd="$(readlink -f "/proc/${active_pid}/cwd"');
    expect(script).toContain('[[ "$active_cwd" == "$release_dir" ]]');
  });
});
