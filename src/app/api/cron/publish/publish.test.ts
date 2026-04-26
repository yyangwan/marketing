import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  prisma: {
    contentSchedule: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    contentPiece: {
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

      (prisma.contentSchedule.findMany as any).mockResolvedValue([]);

      const response = await GET(
        { headers } as Request
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.processed).toBe(0);
      expect(data.message).toBe("No due content found");
    });

    it("should publish due content successfully", async () => {
      process.env.CRON_SECRET = "test-secret";

      const headers = new Headers();
      headers.set("authorization", "Bearer test-secret");

      const mockSchedules = [
        {
          id: "s1",
          contentId: "c1",
          status: "scheduled",
          contentPiece: {
            id: "c1",
            title: "Test Content",
            projectId: "p1",
          },
        },
      ];

      (prisma.contentSchedule.findMany as any).mockResolvedValue(mockSchedules);
      (prisma.contentSchedule.update as any).mockResolvedValue({});
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

      const mockSchedules = [
        {
          id: "s1",
          contentId: "c1",
          status: "scheduled",
          contentPiece: {
            id: "c1",
            title: "Failing Content",
            projectId: "p1",
          },
        },
      ];

      let callCount = 0;
      (prisma.contentSchedule.findMany as any).mockResolvedValue(mockSchedules);
      (prisma.contentSchedule.update as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({}); // First call to set status to "publishing"
        }
        if (callCount === 2) {
          return Promise.reject(new Error("Publish failed")); // Second call fails
        }
        if (callCount === 3) {
          return Promise.resolve({}); // Third call to set status to "failed"
        }
        return Promise.resolve({});
      });
      (prisma.contentPiece.update as any).mockResolvedValue({});
      (prisma.notification.create as any).mockResolvedValue({});

      const response = await GET(
        { headers } as Request
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.processed).toBe(1);
      expect(data.published).toBe(0);
      expect(data.failed).toBe(1);
      expect(data.errors).toHaveLength(1);
      expect(data.errors[0].id).toBe("s1");
    });

    it("should process multiple schedules", async () => {
      process.env.CRON_SECRET = "test-secret";

      const headers = new Headers();
      headers.set("authorization", "Bearer test-secret");

      const mockSchedules = [
        {
          id: "s1",
          contentId: "c1",
          status: "scheduled",
          contentPiece: {
            id: "c1",
            title: "Content 1",
            projectId: "p1",
          },
        },
        {
          id: "s2",
          contentId: "c2",
          status: "scheduled",
          contentPiece: {
            id: "c2",
            title: "Content 2",
            projectId: "p1",
          },
        },
      ];

      (prisma.contentSchedule.findMany as any).mockResolvedValue(mockSchedules);
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

      (prisma.contentSchedule.findMany as any).mockRejectedValue(new Error("DB error"));

      const response = await GET(
        { headers } as Request
      );

      expect(response.status).toBe(500);
    });

    it("should update schedule status to publishing", async () => {
      process.env.CRON_SECRET = "test-secret";

      const headers = new Headers();
      headers.set("authorization", "Bearer test-secret");

      const mockSchedules = [
        {
          id: "s1",
          contentId: "c1",
          status: "scheduled",
          contentPiece: {
            id: "c1",
            title: "Content",
            projectId: "p1",
          },
        },
      ];

      (prisma.contentSchedule.findMany as any).mockResolvedValue(mockSchedules);
      (prisma.contentSchedule.update as any).mockResolvedValue({});
      (prisma.contentPiece.update as any).mockResolvedValue({});
      (prisma.notification.create as any).mockResolvedValue({});

      await GET(
        { headers } as Request
      );

      expect(prisma.contentSchedule.update).toHaveBeenCalledWith({
        where: { id: "s1" },
        data: { status: "publishing" },
      });
    });

    it("should update schedule status to published", async () => {
      process.env.CRON_SECRET = "test-secret";

      const headers = new Headers();
      headers.set("authorization", "Bearer test-secret");

      const mockSchedules = [
        {
          id: "s1",
          contentId: "c1",
          status: "scheduled",
          contentPiece: {
            id: "c1",
            title: "Content",
            projectId: "p1",
          },
        },
      ];

      let updateCallCount = 0;
      (prisma.contentSchedule.findMany as any).mockResolvedValue(mockSchedules);
      (prisma.contentSchedule.update as any).mockImplementation(() => {
        updateCallCount++;
        return Promise.resolve({});
      });
      (prisma.contentPiece.update as any).mockResolvedValue({});
      (prisma.notification.create as any).mockResolvedValue({});

      await GET(
        { headers } as Request
      );

      expect(updateCallCount).toBe(2); // First for publishing, then for published
      expect(prisma.contentPiece.update).toHaveBeenCalledWith({
        where: { id: "c1" },
        data: { status: "published" },
      });
    });

    it("should update schedule status to failed on error", async () => {
      process.env.CRON_SECRET = "test-secret";

      const headers = new Headers();
      headers.set("authorization", "Bearer test-secret");

      const mockSchedules = [
        {
          id: "s1",
          contentId: "c1",
          status: "scheduled",
          contentPiece: {
            id: "c1",
            title: "Content",
            projectId: "p1",
          },
        },
      ];

      let callCount = 0;
      (prisma.contentSchedule.findMany as any).mockResolvedValue(mockSchedules);
      (prisma.contentSchedule.update as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({}); // Set to "publishing"
        }
        if (callCount === 2) {
          return Promise.reject(new Error("Failed")); // Publish fails
        }
        return Promise.resolve({}); // Set to "failed"
      });

      const response = await GET(
        { headers } as Request
      );

      const data = await response.json();
      expect(data.failed).toBe(1);
      expect(data.errors).toHaveLength(1);
    });
  });
});
