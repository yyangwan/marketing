import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  prisma: {
    contentSchedule: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/config", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/auth/workspace", () => ({
  getCurrentWorkspace: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";

describe("/api/calendar/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET - Fetch calendar events", () => {
    it("should return events for date range", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockWs = { workspaceId: "ws1" };
      const mockSchedules = [
        {
          id: "s1",
          scheduledAt: new Date("2025-01-01T10:00:00Z"),
          status: "scheduled",
          contentPiece: {
            id: "c1",
            title: "Content 1",
            project: {
              id: "p1",
              workspaceId: "ws1",
            },
          },
        },
      ];

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(mockWs);
      (prisma.contentSchedule.findMany as any).mockResolvedValue(mockSchedules);

      const response = await GET(
        { url: "http://localhost:3000/api/calendar/events?start=2025-01-01&end=2025-01-31" } as Request
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe("s1");
      expect(data[0].contentPiece.title).toBe("Content 1");
    });

    it("should filter by project when projectId is provided", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockWs = { workspaceId: "ws1" };
      const mockSchedules = [
        {
          id: "s1",
          contentPiece: {
            id: "c1",
            project: {
              id: "p1",
              workspaceId: "ws1",
            },
          },
        },
        {
          id: "s2",
          contentPiece: {
            id: "c2",
            project: {
              id: "p2",
              workspaceId: "ws1",
            },
          },
        },
      ];

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(mockWs);
      (prisma.contentSchedule.findMany as any).mockResolvedValue(mockSchedules);

      const response = await GET(
        { url: "http://localhost:3000/api/calendar/events?start=2025-01-01&end=2025-01-31&projectId=p1" } as Request
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.length).toBe(1);
      expect(data[0].contentPiece.project.id).toBe("p1");
    });

    it("should filter by status when status is provided", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockWs = { workspaceId: "ws1" };
      const mockSchedules = [
        {
          id: "s1",
          status: "published",
          contentPiece: {
            project: { workspaceId: "ws1" },
          },
        },
      ];

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(mockWs);
      (prisma.contentSchedule.findMany as any).mockResolvedValue(mockSchedules);

      const response = await GET(
        { url: "http://localhost:3000/api/calendar/events?start=2025-01-01&end=2025-01-31&status=published" } as Request
      );

      expect(response.status).toBe(200);
      expect(prisma.contentSchedule.findMany).toHaveBeenCalledWith({
        where: {
          scheduledAt: {
            gte: new Date("2025-01-01"),
            lte: new Date("2025-01-31"),
          },
          status: "published",
        },
        include: {
          contentPiece: {
            include: {
              project: true,
            },
          },
        },
        orderBy: { scheduledAt: "asc" },
      });
    });

    it("should return 400 when start is missing", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1" });

      const response = await GET(
        { url: "http://localhost:3000/api/calendar/events?end=2025-01-31" } as Request
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("invalid_input");
    });

    it("should return 400 when end is missing", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1" });

      const response = await GET(
        { url: "http://localhost:3000/api/calendar/events?start=2025-01-01" } as Request
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("invalid_input");
    });

    it("should return 401 for unauthorized requests", async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const response = await GET(
        { url: "http://localhost:3000/api/calendar/events?start=2025-01-01&end=2025-01-31" } as Request
      );

      expect(response.status).toBe(401);
    });

    it("should return 403 when workspace is not found", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(null);

      const response = await GET(
        { url: "http://localhost:3000/api/calendar/events?start=2025-01-01&end=2025-01-31" } as Request
      );

      expect(response.status).toBe(403);
    });

    it("should filter out events from other workspaces", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockWs = { workspaceId: "ws1" };
      const mockSchedules = [
        {
          id: "s1",
          contentPiece: {
            project: {
              workspaceId: "ws2", // Different workspace
            },
          },
        },
        {
          id: "s2",
          contentPiece: {
            project: {
              workspaceId: "ws1", // Same workspace
            },
          },
        },
      ];

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(mockWs);
      (prisma.contentSchedule.findMany as any).mockResolvedValue(mockSchedules);

      const response = await GET(
        { url: "http://localhost:3000/api/calendar/events?start=2025-01-01&end=2025-01-31" } as Request
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.length).toBe(1);
      expect(data[0].contentPiece.project.workspaceId).toBe("ws1");
    });

    it("should return 500 on database error", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1" });
      (prisma.contentSchedule.findMany as any).mockRejectedValue(new Error("DB error"));

      const response = await GET(
        { url: "http://localhost:3000/api/calendar/events?start=2025-01-01&end=2025-01-31" } as Request
      );

      expect(response.status).toBe(500);
    });
  });
});
