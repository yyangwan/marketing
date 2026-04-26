import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST, DELETE } from "./route";

// Custom matcher for date comparison
expect.extend({
  toMatchDate(received: any, expected: any) {
    const receivedDate = new Date(received);
    const expectedDate = new Date(expected);
    const pass = Math.abs(receivedDate.getTime() - expectedDate.getTime()) < 1000;
    return {
      pass,
      message: () =>
        pass
          ? "Dates match"
          : `Expected ${receivedDate.toISOString()} to match ${expectedDate.toISOString()}`,
    };
  },
});

// Mock dependencies
vi.mock("@/lib/db", () => ({
  prisma: {
    contentSchedule: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
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

vi.mock("@/lib/auth/config", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/auth/workspace", () => ({
  getCurrentWorkspace: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";

describe("/api/content/[id]/schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET - Fetch schedule", () => {
    it("should return existing schedule", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockWs = { workspaceId: "ws1" };
      const mockSchedule = { id: "schedule1", scheduledAt: new Date("2025-01-01T10:00:00Z"), status: "scheduled" };
      const mockContent = { id: "content1", schedules: [mockSchedule] };

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(mockWs);
      (prisma.contentPiece.findFirst as any).mockResolvedValue(mockContent);

      const response = await GET(
        { url: "http://localhost:3000/api/content/content1/schedule" } as Request,
        { params: Promise.resolve({ id: "content1" }) }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeTruthy();
      expect(data.id).toBe("schedule1");
    });

    it("should return null when no schedule exists", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockWs = { workspaceId: "ws1" };
      const mockContent = { id: "content1", schedules: [] };

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(mockWs);
      (prisma.contentPiece.findFirst as any).mockResolvedValue(mockContent);

      const response = await GET(
        { url: "http://localhost:3000/api/content/content1/schedule" } as Request,
        { params: Promise.resolve({ id: "content1" }) }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeNull();
    });

    it("should return 401 for unauthorized requests", async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const response = await GET(
        { url: "http://localhost:3000/api/content/content1/schedule" } as Request,
        { params: Promise.resolve({ id: "content1" }) }
      );

      expect(response.status).toBe(401);
    });

    it("should return 403 when workspace is not found", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(null);

      const response = await GET(
        { url: "http://localhost:3000/api/content/content1/schedule" } as Request,
        { params: Promise.resolve({ id: "content1" }) }
      );

      expect(response.status).toBe(403);
    });

    it("should return 404 when content not found", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockWs = { workspaceId: "ws1" };

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(mockWs);
      (prisma.contentPiece.findFirst as any).mockResolvedValue(null);

      const response = await GET(
        { url: "http://localhost:3000/api/content/content1/schedule" } as Request,
        { params: Promise.resolve({ id: "content1" }) }
      );

      expect(response.status).toBe(404);
    });
  });

  describe("POST - Create schedule", () => {
    it("should create a new schedule", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockWs = { workspaceId: "ws1" };
      const mockContent = { id: "content1", title: "Test Content" };
      const mockSchedule = { id: "schedule1", scheduledAt: new Date("2025-01-01T10:00:00Z"), status: "scheduled" };

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(mockWs);
      (prisma.contentPiece.findFirst as any).mockResolvedValue(mockContent);
      (prisma.contentSchedule.findFirst as any).mockResolvedValue(null);
      (prisma.contentSchedule.create as any).mockResolvedValue(mockSchedule);
      (prisma.contentPiece.update as any).mockResolvedValue({});
      (prisma.notification.create as any).mockResolvedValue({});

      const request = {
        json: async () => ({ scheduledAt: "2025-01-01T10:00:00Z" }),
      } as Request;

      const response = await POST(request, { params: Promise.resolve({ id: "content1" }) });

      expect(response.status).toBe(201);
      expect(prisma.contentSchedule.create).toHaveBeenCalledWith({
        data: {
          contentId: "content1",
          scheduledAt: new Date("2025-01-01T10:00:00Z"),
          status: "scheduled",
        },
      });
    });

    it("should update existing schedule", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockWs = { workspaceId: "ws1" };
      const mockContent = { id: "content1", title: "Test Content" };
      const existingSchedule = { id: "schedule1" };
      const updatedSchedule = { id: "schedule1", scheduledAt: new Date("2025-01-02T10:00:00Z"), status: "scheduled" };

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(mockWs);
      (prisma.contentPiece.findFirst as any).mockResolvedValue(mockContent);
      (prisma.contentSchedule.findFirst as any).mockResolvedValue(existingSchedule);
      (prisma.contentSchedule.update as any).mockResolvedValue(updatedSchedule);
      (prisma.contentPiece.update as any).mockResolvedValue({});
      (prisma.notification.create as any).mockResolvedValue({});

      const request = {
        json: async () => ({ scheduledAt: "2025-01-02T10:00:00Z" }),
      } as Request;

      const response = await POST(request, { params: Promise.resolve({ id: "content1" }) });

      expect(response.status).toBe(201);
      expect(prisma.contentSchedule.update).toHaveBeenCalledWith({
        where: { id: "schedule1" },
        data: {
          scheduledAt: new Date("2025-01-02T10:00:00Z"),
          status: "scheduled",
        },
      });
    });

    it("should return 401 for unauthorized requests", async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const request = {
        json: async () => ({ scheduledAt: "2025-01-01T10:00:00Z" }),
      } as Request;

      const response = await POST(request, { params: Promise.resolve({ id: "content1" }) });

      expect(response.status).toBe(401);
    });

    it("should return 403 when workspace is not found", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(null);

      const request = {
        json: async () => ({ scheduledAt: "2025-01-01T10:00:00Z" }),
      } as Request;

      const response = await POST(request, { params: Promise.resolve({ id: "content1" }) });

      expect(response.status).toBe(403);
    });

    it("should return 400 for missing scheduledAt", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1" });

      const request = {
        json: async () => ({}),
      } as Request;

      const response = await POST(request, { params: Promise.resolve({ id: "content1" }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("invalid_input");
    });

    it("should return 400 for invalid date format", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1" });

      const request = {
        json: async () => ({ scheduledAt: "invalid-date" }),
      } as Request;

      const response = await POST(request, { params: Promise.resolve({ id: "content1" }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("invalid_input");
      expect(data.message).toBe("Invalid date format");
    });

    it("should return 404 when content not found", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1" });
      (prisma.contentPiece.findFirst as any).mockResolvedValue(null);

      const request = {
        json: async () => ({ scheduledAt: "2025-01-01T10:00:00Z" }),
      } as Request;

      const response = await POST(request, { params: Promise.resolve({ id: "content1" }) });

      expect(response.status).toBe(404);
    });

    it("should return 500 on database error", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1" });
      const mockContent = { id: "content1", title: "Test Content" };
      (prisma.contentPiece.findFirst as any).mockResolvedValue(mockContent);
      (prisma.contentSchedule.findFirst as any).mockRejectedValue(new Error("DB error"));

      const request = {
        json: async () => ({ scheduledAt: "2025-01-01T10:00:00Z" }),
      } as Request;

      const response = await POST(request, { params: Promise.resolve({ id: "content1" }) });

      expect(response.status).toBe(500);
    });
  });

  describe("DELETE - Remove schedule", () => {
    it("should delete a schedule", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockWs = { workspaceId: "ws1" };
      const mockContent = { id: "content1" };

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(mockWs);
      (prisma.contentPiece.findFirst as any).mockResolvedValue(mockContent);
      (prisma.contentSchedule.deleteMany as any).mockResolvedValue({ count: 1 });
      (prisma.contentPiece.update as any).mockResolvedValue({});

      const response = await DELETE(
        {} as Request,
        { params: Promise.resolve({ id: "content1" }) }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it("should return 401 for unauthorized requests", async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const response = await DELETE(
        {} as Request,
        { params: Promise.resolve({ id: "content1" }) }
      );

      expect(response.status).toBe(401);
    });

    it("should return 403 when workspace is not found", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(null);

      const response = await DELETE(
        {} as Request,
        { params: Promise.resolve({ id: "content1" }) }
      );

      expect(response.status).toBe(403);
    });

    it("should return 404 when content not found", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1" });
      (prisma.contentPiece.findFirst as any).mockResolvedValue(null);

      const response = await DELETE(
        {} as Request,
        { params: Promise.resolve({ id: "content1" }) }
      );

      expect(response.status).toBe(404);
    });

    it("should return 500 on database error", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1" });
      (prisma.contentPiece.findFirst as any).mockResolvedValue({ id: "content1" });
      (prisma.contentSchedule.deleteMany as any).mockRejectedValue(new Error("DB error"));

      const response = await DELETE(
        {} as Request,
        { params: Promise.resolve({ id: "content1" }) }
      );

      expect(response.status).toBe(500);
    });
  });
});
