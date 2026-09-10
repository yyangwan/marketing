import { describe, expect, it } from "vitest";
import { parseSupportedPlatforms } from "./validate";

describe("parseSupportedPlatforms", () => {
  it("accepts the four supported platforms and dedupes", () => {
    const result = parseSupportedPlatforms(["wechat", "weibo", "wechat", "xiaohongshu", "douyin"]);
    expect(result).toEqual({
      ok: true,
      platforms: ["wechat", "weibo", "xiaohongshu", "douyin"],
    });
  });

  it("accepts a single platform string", () => {
    expect(parseSupportedPlatforms("wechat")).toEqual({ ok: true, platforms: ["wechat"] });
  });

  it("rejects empty input with PLATFORM_MISSING", () => {
    const result = parseSupportedPlatforms([]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PLATFORM_MISSING");
    }
  });

  it("rejects undefined/missing input", () => {
    const result = parseSupportedPlatforms(undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PLATFORM_MISSING");
    }
  });

  it("rejects zhihu and toutiao with PLATFORM_NOT_SUPPORTED", () => {
    const result = parseSupportedPlatforms(["zhihu", "toutiao"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PLATFORM_NOT_SUPPORTED");
      expect(result.invalid).toEqual(["zhihu", "toutiao"]);
    }
  });

  it("rejects mixed input entirely — never partially adopts valid entries", () => {
    const result = parseSupportedPlatforms(["wechat", "zhihu"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PLATFORM_NOT_SUPPORTED");
      expect(result.invalid).toEqual(["zhihu"]);
    }
  });

  it("rejects non-string entries", () => {
    const result = parseSupportedPlatforms([123, null]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PLATFORM_NOT_SUPPORTED");
    }
  });
});
