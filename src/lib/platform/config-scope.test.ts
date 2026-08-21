import { describe, expect, it } from "vitest";
import { getPlatformConfigKey, getPlatformConfigScope } from "./config-scope";

describe("platform config scope", () => {
  it("binds a platform configuration to workspace, project, and user", () => {
    expect(getPlatformConfigKey({
      workspaceId: "workspace-a",
      projectId: "project-a",
      userId: "user-a",
    }, "fallback-user", "wechat")).toEqual({
      workspaceId: "workspace-a",
      projectId: "project-a",
      userId: "user-a",
      platform: "wechat",
    });
  });

  it("uses explicit safe fallbacks for legacy direct sessions", () => {
    expect(getPlatformConfigScope({ workspaceId: "workspace-a" }, "user-a")).toEqual({
      workspaceId: "workspace-a",
      projectId: "workspace-a",
      userId: "user-a",
    });
  });
});
