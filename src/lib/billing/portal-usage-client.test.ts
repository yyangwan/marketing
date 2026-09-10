// 评审 R12：额度回调的超时窗口必须覆盖完整响应体读取——
// 此前 fetch 返回响应头就 clearTimeout，停滞的 body 会让 worker 无限期占用执行槽。
// 覆盖：① 响应头到达但 body 停滞 → 10s 超时中止 → 以空体结果返回，不悬挂；
//       ② body 正常返回 → 正常结果且未触发中止。

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/portal", () => ({
  getPortalBaseUrl: () => "http://portal.test",
  getUsageCallbackSecret: () => "secret-1",
}));

import { commitUsageOperation } from "./portal-usage-client";

function responseWith(body: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("portal-usage-client 超时覆盖响应体（R12）", () => {
  it("aborts a stalled response body within the timeout window", async () => {
    vi.useFakeTimers();
    let aborted = false;
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_url: unknown, init?: RequestInit) =>
        ({
          ok: true,
          status: 200,
          // body 永远不完成：真实 fetch 会随 signal 中止而 reject，这里模拟同一语义。
          json: () =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () => {
                aborted = true;
                reject(new DOMException("Aborted", "AbortError"));
              });
            }),
        }) as unknown as Response,
    );

    const pending = commitUsageOperation("op-1");
    const assertion = pending.then((result) => {
      // body 读取失败退化为空对象：调用不悬挂，返回可判定的结果。
      expect(aborted).toBe(true);
      expect(result.ok).toBe(true);
    });

    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });

  it("returns the portal result when the body completes in time", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      responseWith({ data: { status: "committed" } }),
    );

    const pending = commitUsageOperation("op-2");
    const assertion = pending.then((result) => {
      expect(result).toEqual({ ok: true, status: "committed" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await vi.advanceTimersByTimeAsync(0);
    await assertion;
  });

  it("does not clear the timer after response headers arrive", async () => {
    vi.useFakeTimers();
    // 头到达后 body 停滞 5s 再完成：仍处于 10s 窗口内，正常返回且未中止。
    let aborted = false;
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_url: unknown, init?: RequestInit) =>
        ({
          ok: true,
          status: 200,
          json: () =>
            new Promise((resolve) => {
              init?.signal?.addEventListener("abort", () => {
                aborted = true;
              });
              setTimeout(() => resolve({ data: { status: "committed" } }), 5_000);
            }),
        }) as unknown as Response,
    );

    const pending = commitUsageOperation("op-3");
    const assertion = pending.then((result) => {
      expect(aborted).toBe(false);
      expect(result).toEqual({ ok: true, status: "committed" });
    });

    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
  });
});
