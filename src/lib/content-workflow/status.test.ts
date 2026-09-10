import { describe, expect, it } from "vitest";
import { aggregateWorkflowStatus, classifyLlmError, retryDelayMs } from "./status";

describe("aggregateWorkflowStatus（设计 §9.2）", () => {
  it("all succeeded → succeeded", () => {
    expect(
      aggregateWorkflowStatus([
        { platform: "wechat", status: "succeeded" },
        { platform: "weibo", status: "succeeded" },
      ]),
    ).toBe("succeeded");
  });

  it("any queued/generating → generating", () => {
    expect(
      aggregateWorkflowStatus([
        { platform: "wechat", status: "succeeded" },
        { platform: "weibo", status: "queued" },
      ]),
    ).toBe("generating");
    expect(
      aggregateWorkflowStatus([
        { platform: "wechat", status: "generating" },
        { platform: "weibo", status: "failed_retryable" },
      ]),
    ).toBe("generating");
  });

  it("mixed success and final failure → partial", () => {
    expect(
      aggregateWorkflowStatus([
        { platform: "wechat", status: "succeeded" },
        { platform: "xiaohongshu", status: "failed_terminal" },
      ]),
    ).toBe("partial");
    expect(
      aggregateWorkflowStatus([
        { platform: "wechat", status: "succeeded" },
        { platform: "weibo", status: "failed_terminal" },
        { platform: "douyin", status: "cancelled" },
      ]),
    ).toBe("partial");
  });

  it("all final failure → failed", () => {
    expect(
      aggregateWorkflowStatus([
        { platform: "wechat", status: "failed_terminal" },
        { platform: "weibo", status: "failed_terminal" },
      ]),
    ).toBe("failed");
  });

  it("failed_retryable is backoff-waiting, not terminal (R10)", () => {
    // 退避等待的自动重试不算失败：工作流保持 generating，前端继续轮询。
    expect(
      aggregateWorkflowStatus([
        { platform: "wechat", status: "succeeded" },
        { platform: "xiaohongshu", status: "failed_retryable" },
      ]),
    ).toBe("generating");
    expect(
      aggregateWorkflowStatus([
        { platform: "wechat", status: "failed_retryable" },
        { platform: "weibo", status: "failed_retryable" },
      ]),
    ).toBe("generating");
  });

  it("all cancelled → cancelled", () => {
    expect(
      aggregateWorkflowStatus([
        { platform: "wechat", status: "cancelled" },
        { platform: "weibo", status: "cancelled" },
      ]),
    ).toBe("cancelled");
  });

  it("empty runs → queued", () => {
    expect(aggregateWorkflowStatus([])).toBe("queued");
  });
});

describe("classifyLlmError", () => {
  it("timeout/rate-limit/5xx are retryable", () => {
    expect(classifyLlmError({ name: "LLMError", statusCode: 408, message: "t" }).kind).toBe("retryable");
    expect(classifyLlmError({ name: "LLMError", statusCode: 429, message: "t" }).kind).toBe("retryable");
    expect(classifyLlmError({ name: "LLMError", statusCode: 502, message: "t" }).kind).toBe("retryable");
  });

  it("4xx output problems are terminal", () => {
    const result = classifyLlmError({ name: "LLMError", statusCode: 422, message: "invalid json" });
    expect(result.kind).toBe("terminal");
  });

  it("unknown errors default to retryable", () => {
    expect(classifyLlmError(new Error("socket hang up")).kind).toBe("retryable");
  });
});

describe("retryDelayMs", () => {
  it("returns backoff values with bounded jitter", () => {
    for (let i = 0; i < 20; i++) {
      const delay = retryDelayMs(1);
      expect(delay).toBeGreaterThanOrEqual(4000);
      expect(delay).toBeLessThanOrEqual(6000);
    }
  });
});
