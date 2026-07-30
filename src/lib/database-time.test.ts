import { describe, expect, it } from "vitest";
import { withUtcDatabaseTimezone } from "./database-time";

describe("database timezone", () => {
  it("forces MariaDB connections and sessions to UTC", () => {
    const result = new URL(
      withUtcDatabaseTimezone("mysql://user:secret@localhost:3306/content"),
    );

    expect(result.protocol).toBe("mariadb:");
    expect(result.searchParams.get("timezone")).toBe("Z");
  });

  it("overrides an unsafe existing timezone", () => {
    const result = new URL(
      withUtcDatabaseTimezone(
        "mariadb://user:secret@localhost:3306/content?timezone=local",
      ),
    );

    expect(result.searchParams.get("timezone")).toBe("Z");
  });
});
