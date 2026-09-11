/**
 * Platform Publisher Tests
 * Phase 1F: Real Publishing Integration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { WeChatPublisher, getWeChatOAuthUrl } from "../wechat";
import { WeiboPublisher, getWeiboOAuthUrl } from "../weibo";
import { XiaohongshuPublisher, getXiaohongshuOAuthUrl } from "../xiaohongshu";
import { DouyinPublisher, getDouyinOAuthUrl } from "../douyin";

describe("Platform Publishers", () => {
  describe("WeChat Publisher", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("should generate OAuth URL", () => {
      const url = getWeChatOAuthUrl("test-app-id", "https://example.com/callback", "test-state");
      expect(url).toContain("open.weixin.qq.com");
      expect(url).toContain("appid=test-app-id");
      expect(url).toContain("redirect_uri=https%3A%2F%2Fexample.com%2Fcallback");
      expect(url).toContain("state=test-state");
    });

    it("should create publisher with credentials", () => {
      const credentials = {
        appId: "test-app-id",
        appSecret: "test-secret",
        accessToken: "test-token",
      };
      const publisher = new WeChatPublisher(credentials);
      expect(publisher).toBeDefined();
      expect(publisher["credentials"]).toEqual(credentials);
    });

    it("should obtain an access token with app credentials before publishing", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "fresh-token", expires_in: 7200 })))
        .mockResolvedValueOnce(new Response(new Blob(["image"], { type: "image/png" })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ media_id: "cover-1", url: "https://example.com/cover" })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ media_id: "draft-1" })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ errcode: 0, errmsg: "ok" })));
      const publisher = new WeChatPublisher({
        appId: "test-app-id",
        appSecret: "test-secret",
      });

      const result = await publisher.publish({
        title: "Test",
        content: "Test content",
        images: ["http://localhost/wechat-default-cover.png"],
      });

      expect(result.success).toBe(true);
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=test-app-id&secret=test-secret",
      );
      expect(fetchMock).toHaveBeenNthCalledWith(2, "http://localhost/wechat-default-cover.png");
    });

    it("should stop before draft creation when no cover image is available", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch");
      const publisher = new WeChatPublisher({
        appId: "test-app-id",
        appSecret: "test-secret",
        accessToken: "test-token",
      });

      const result = await publisher.publish({ title: "Test", content: "Test content" });

      expect(result).toEqual({
        success: false,
        errorMessage: "微信公众号发布需要封面图片。",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should keep the draft media id and guide manual publish when freepublish is unauthorized (48001)", async () => {
      // 生产 2026-09-11 实际时序：token ✓ 封面 ✓ 草稿 ✓，freepublish/submit 返回 48001。
      const fetchMock = vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response(new Blob(["image"], { type: "image/png" })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ media_id: "cover-1" })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ media_id: "draft-1" })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ errcode: 48001, errmsg: "api unauthorized rid: test-rid" })));
      const publisher = new WeChatPublisher({
        appId: "test-app-id",
        appSecret: "test-secret",
        accessToken: "test-token",
      });

      const result = await publisher.publish({
        title: "Test",
        content: "Test content",
        images: ["http://localhost/wechat-default-cover.png"],
      });

      expect(result.success).toBe(false);
      expect(result.draftMediaId).toBe("draft-1");
      expect(result.errorMessage).toContain("api unauthorized");
      expect(result.errorMessage).toContain("草稿箱");
      expect(result.errorMessage).toContain("mp.weixin.qq.com");
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it("should update the existing draft instead of creating another one on retry", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response(new Blob(["image"], { type: "image/png" })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ media_id: "cover-1" })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ errcode: 0, errmsg: "ok" })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ errcode: 0, errmsg: "ok" })));
      const publisher = new WeChatPublisher({
        appId: "test-app-id",
        appSecret: "test-secret",
        accessToken: "test-token",
      });

      const result = await publisher.publish({
        title: "Test v2",
        content: "Updated content",
        images: ["http://localhost/wechat-default-cover.png"],
        existingDraftMediaId: "draft-1",
      });

      expect(result.success).toBe(true);
      expect(result.platformPostId).toBe("draft-1");
      const draftUpdateCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/draft/update"));
      expect(draftUpdateCall).toBeDefined();
      expect(JSON.stringify(draftUpdateCall?.[1]?.body)).toContain("draft-1");
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/draft/add"))).toBe(false);
    });

    it("should fall back to draft/add when the existing draft no longer exists", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response(new Blob(["image"], { type: "image/png" })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ media_id: "cover-1" })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ errcode: 40007, errmsg: "invalid media_id" })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ media_id: "draft-2" })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ errcode: 48001, errmsg: "api unauthorized rid: r" })));
      const publisher = new WeChatPublisher({
        appId: "test-app-id",
        appSecret: "test-secret",
        accessToken: "test-token",
      });

      const result = await publisher.publish({
        title: "Test",
        content: "Test content",
        images: ["http://localhost/wechat-default-cover.png"],
        existingDraftMediaId: "draft-deleted",
      });

      expect(result.success).toBe(false);
      // 原草稿已删除：回退新建，草稿 id 换成新的，不再指向失效的 draft-deleted。
      expect(result.draftMediaId).toBe("draft-2");
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/draft/add"))).toBe(true);
    });
  });

  describe("Weibo Publisher", () => {
    it("should generate OAuth URL", () => {
      const url = getWeiboOAuthUrl("test-app-id", "https://example.com/callback", "test-state");
      expect(url).toContain("api.weibo.com");
      expect(url).toContain("client_id=test-app-id");
      expect(url).toContain("redirect_uri=https%3A%2F%2Fexample.com%2Fcallback");
      expect(url).toContain("state=test-state");
    });

    it("should create publisher with credentials", () => {
      const credentials = {
        appId: "test-app-key",
        appSecret: "test-secret",
        accessToken: "test-token",
      };
      const publisher = new WeiboPublisher(credentials);
      expect(publisher).toBeDefined();
    });

    it("should return error when no access token", async () => {
      const publisher = new WeiboPublisher({
        appId: "test-app-key",
        appSecret: "test-secret",
      });

      const result = await publisher.publish({
        title: "Test",
        content: "Test content",
      });

      expect(result.success).toBe(false);
      expect(result.needsAuth).toBe(true);
    });
  });

  describe("Xiaohongshu Publisher", () => {
    it("should generate OAuth URL", () => {
      const url = getXiaohongshuOAuthUrl("test-app-id", "https://example.com/callback", "test-state");
      expect(url).toContain("xiaohongshu.com");
      expect(url).toContain("appid=test-app-id");
    });

    it("should create publisher with credentials", () => {
      const credentials = {
        appId: "test-app-id",
        appSecret: "test-secret",
        accessToken: "test-token",
        refreshToken: "test-refresh",
      };
      const publisher = new XiaohongshuPublisher(credentials);
      expect(publisher).toBeDefined();
    });

    it("should require images for publishing", async () => {
      const publisher = new XiaohongshuPublisher({
        appId: "test-app-id",
        accessToken: "test-token",
        refreshToken: "test-refresh",
        tokenExpiresAt: new Date(Date.now() + 3600000), // Valid for 1 hour
      });

      const result = await publisher.publish({
        title: "Test",
        content: "Test content",
        images: [],
      });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain("image");
    });

    it("should return error when no access token", async () => {
      const publisher = new XiaohongshuPublisher({
        appId: "test-app-id",
      });

      const result = await publisher.publish({
        title: "Test",
        content: "Test content",
        images: ["https://example.com/image.jpg"],
      });

      expect(result.success).toBe(false);
      expect(result.needsAuth).toBe(true);
    });
  });

  describe("Douyin Publisher", () => {
    it("should generate OAuth URL", () => {
      const url = getDouyinOAuthUrl("test-app-id", "https://example.com/callback", "test-state");
      expect(url).toContain("developer.toutiao.com");
      expect(url).toContain("app_id=test-app-id");
    });

    it("should create publisher with credentials", () => {
      const credentials = {
        appId: "test-app-id",
        appSecret: "test-secret",
        accessToken: "test-token",
      };
      const publisher = new DouyinPublisher(credentials);
      expect(publisher).toBeDefined();
    });

    it("should require images for publishing", async () => {
      const publisher = new DouyinPublisher({
        appId: "test-app-id",
        appSecret: "test-secret",
        accessToken: "test-token",
        refreshToken: "test-refresh-token",
      });

      const result = await publisher.publish({
        title: "Test",
        content: "Test content",
        images: [],
      });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain("image");
    });

    it("should return error when no access token", async () => {
      const publisher = new DouyinPublisher({
        appId: "test-app-id",
      });

      const result = await publisher.publish({
        title: "Test",
        content: "Test content",
        images: ["https://example.com/image.jpg"],
      });

      expect(result.success).toBe(false);
      expect(result.needsAuth).toBe(true);
    });
  });
});

describe("Platform Publisher Factory", () => {
  it("should export all required functions", async () => {
    const platformModule = await import("../index");
    expect(platformModule.getPlatformPublisher).toBeDefined();
    expect(platformModule.getPlatformOAuthUrl).toBeDefined();
    expect(platformModule.getPlatformAccessToken).toBeDefined();
    expect(platformModule.publishToPlatform).toBeDefined();
  });
});
