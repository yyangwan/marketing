import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "./route";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  prisma: {
    contentSchedule: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    contentPiece: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";

describe("/api/cron/publish", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("GET - Cron job for publishing content", () => {
    it("should return 500 when CRON_SECRET is not configured", async () => {
      delete process.env.CRON_SECRET;

      const response = await GET(
        { headers: new Headers() } as Request
      );

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("cron_not_configured");
    });

    it("should return 401 when authorization header is missing", async () => {
      process.env.CRON_SECRET = "test-secret";

      const response = await GET(
        { headers: new Headers() } as Request
      );

      expect(response.status).toBe(401);
    });

    it("should return 401 when authorization header is invalid", async () => {
      process.env.CRON_SECRET = "test-secret";

      const headers = new Headers();
      headers.set("authorization", "Bearer wrong-secret");

      const response = await GET(
        { headers } as Request
      );

      expect(response.status).toBe(401);
    });

    it("should return success when no due content is found", async () => {
      process.env.CRON_SECRET = "test-secret";

      const headers = new Headers();
      headers.set("authorization", "Bearer test-secret");

      // First call returns null (no schedules)
      (prisma.contentSchedule.findFirst as any).mockResolvedValueOnce(null);

      const response = await GET(
        { headers } as Request
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.processed).toBe(0);
      expect(data.published).toBe(0);
      expect(data.failed).toBe(0);
      expect(data.message).toBe("Processed 0 items: 0 published, 0 failed");
    });

    it("should publish due content successfully", async () => {
      process.env.CRON_SECRET = "test-secret";

      const headers = new Headers();
      headers.set("authorization", "Bearer test-secret");

      const mockContentPiece = {
        id: "c1",
        title: "Test Content",
        projectId: "p1",
      };

      // First iteration: find schedule
      (prisma.contentSchedule.findFirst as any)
        .mockResolvedValueOnce({
          id: "s1",
          contentId: "c1",
          status: "scheduled",
          scheduledAt: new Date("2025-01-01T10:00:00Z"),
        })
        // Second iteration: no more schedules
        .mockResolvedValueOnce(null);

      (prisma.contentSchedule.update as any)
        // First update: set to "publishing"
        .mockResolvedValueOnce({})
        // Second update: set to "published"
        .mockResolvedValueOnce({
          id: "s1",
          scheduledAt: new Date("2025-01-01T10:00:00Z"),
          status: "published",
        });

      (prisma.contentPiece.findFirst as any).mockResolvedValue(mockContentPiece);
      (prisma.contentPiece.update as any).mockResolvedValue({});
      (prisma.notification.create as any).mockResolvedValue({});

      const response = await GET(
        { headers } as Request
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.processed).toBe(1);
      expect(data.published).toBe(1);
      expect(data.failed).toBe(0);
    });

    it("should handle publishing errors gracefully", async () => {
      process.env.CRON_SECRET = "test-secret";

      const headers = new Headers();
      headers.set("authorization", "Bearer test-secret");

      const mockContentPiece = {
        id: "c1",
        title: "Failing Content",
        projectId: "p1",
      };

      // Find schedule
      (prisma.contentSchedule.findFirst as any)
        .mockResolvedValueOnce({
          id: "s1",
          contentId: "c1",
          status: "scheduled",
        })
        // No more schedules
        .mockResolvedValueOnce(null);

      (prisma.contentPiece.findFirst as any).mockResolvedValue(mockContentPiece);

      let callCount = 0;
      (prisma.contentSchedule.update as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({}); // Set to "publishing"
        }
        // Simulate failure in simulatePublish
        if (callCount === 2) {
          return Promise.reject(new Error("Publish failed"));
        }
        // Set to "failed"
        return Promise.resolve({});
      });

      const response = await GET(
        { headers } as Request
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.processed).toBe(1);
      expect(data.published).toBe(0);
      expect(data.failed).toBe(1);
    });

    it("should process multiple schedules sequentially", async () => {
      process.env.CRON_SECRET = "test-secret";

      const headers = new Headers();
      headers.set("authorization", "Bearer test-secret");

      const mockContentPiece1 = {
        id: "c1",
        title: "Content 1",
        projectId: "p1",
      };
      const mockContentPiece2 = {
        id: "c2",
        title: "Content 2",
        projectId: "p1",
      };

      // First schedule
      (prisma.contentSchedule.findFirst as any)
        .mockResolvedValueOnce({
          id: "s1",
          contentId: "c1",
          status: "scheduled",
        })
        // Second schedule
        .mockResolvedValueOnce({
          id: "s2",
          contentId: "c2",
          status: "scheduled",
        })
        // No more schedules
        .mockResolvedValueOnce(null);

      (prisma.contentPiece.findFirst as any)
        .mockResolvedValueOnce(mockContentPiece1)
        .mockResolvedValueOnce(mockContentPiece2);

      (prisma.contentSchedule.update as any).mockResolvedValue({});
      (prisma.contentPiece.update as any).mockResolvedValue({});
      (prisma.notification.create as any).mockResolvedValue({});

      const response = await GET(
        { headers } as Request
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.processed).toBe(2);
      expect(data.published).toBe(2);
    });

    it("should return 500 on database error", async () => {
      process.env.CRON_SECRET = "test-secret";

      const headers = new Headers();
      headers.set("authorization", "Bearer test-secret");

      (prisma.contentSchedule.findFirst as any).mockRejectedValue(new Error("DB error"));

      const response = await GET(
        { headers } as Request
      );

      expect(response.status).toBe(500);
    });

    it("should update schedule status through publishing to published", async () => {
      process.env.CRON_SECRET = "test-secret";

      const headers = new Headers();
      headers.set("authorization", "Bearer test-secret");

      const mockContentPiece = {
        id: "c1",
        title: "Content",
        projectId: "p1",
      };

      (prisma.contentSchedule.findFirst as any)
        .mockResolvedValueOnce({
          id: "s1",
          contentId: "c1",
          status: "scheduled",
        })
        .mockResolvedValueOnce(null);

      (prisma.contentPiece.findFirst as any).mockResolvedValue(mockContentPiece);

      const updateCalls: any[] = [];
      (prisma.contentSchedule.update as any).mockImplementation((args: any) => {
        updateCalls.push(args);
        return Promise.resolve({
          id: "s1",
          ...args.data,
        });
      });

      (prisma.contentPiece.update as any).mockResolvedValue({});
      (prisma.notification.create as any).mockResolvedValue({});

      const response = await GET(
        { headers } as Request
      );

      expect(response.status).toBe(200);
      expect(updateCalls).toHaveLength(2); // "publishing" then "published"
      expect(updateCalls[0].data.status).toBe("publishing");
      expect(updateCalls[1].data.status).toBe("published");
    });

    it("should update schedule status to failed on error", async () => {
      process.env.CRON_SECRET = "test-secret";

      const headers = new Headers();
      headers.set("authorization", "Bearer test-secret");

      const mockContentPiece = {
        id: "c1",
        title: "Content",
        projectId: "p1",
      };

      (prisma.contentSchedule.findFirst as any)
        .mockResolvedValueOnce({
          id: "s1",
          contentId: "c1",
          status: "scheduled",
        })
        .mockResolvedValueOnce(null);

      (prisma.contentPiece.findFirst as any).mockResolvedValue(mockContentPiece);

      const updateCalls: any[] = [];
      (prisma.contentSchedule.update as any).mockImplementation((args: any) => {
        updateCalls.push(args);
        // First update: set to "publishing" - succeeds
        if (updateCalls.length === 1) {
          return Promise.resolve({});
        }
        // Second update would be to "published", but simulatePublish fails - reject
        if (updateCalls.length === 2) {
          return Promise.reject(new Error("Publish failed"));
        }
        // Third update: set to "failed" - succeeds (error recovery)
        return Promise.resolve({});
      });

      const response = await GET(
        { headers } as Request
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.failed).toBe(1);
    });
  });
});
