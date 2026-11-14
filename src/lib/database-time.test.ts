import { describe, expect, it } from "vitest";
import { withUtcDatabaseTimezone } from "./database-time";

describe("database timezone", () => {
  it("sets PostgreSQL sessions to UTC", () => {
    const result = new URL(
      withUtcDatabaseTimezone("postgresql://user:secret@localhost:5432/content"),
    );

    expect(result.protocol).toBe("postgresql:");
    expect(result.searchParams.get("options")).toBe("-c timezone=UTC");
  });

  it("overrides an unsafe existing timezone", () => {
    const result = new URL(
      withUtcDatabaseTimezone(
        "postgresql://user:secret@localhost:5432/content?options=-c+timezone%3DAsia%2FShanghai",
      ),
    );

    expect(result.searchParams.get("options")).toBe("-c timezone=Asia/Shanghai -c timezone=UTC");
  });
});
