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

    it("should return error when no access token", async () => {
      const publisher = new WeChatPublisher({
        appId: "test-app-id",
        appSecret: "test-secret",
      });

      const result = await publisher.publish({
        title: "Test",
        content: "Test content",
      });

      expect(result.success).toBe(false);
      expect(result.needsAuth).toBe(true);
      expect(result.errorMessage).toContain("access token");
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
