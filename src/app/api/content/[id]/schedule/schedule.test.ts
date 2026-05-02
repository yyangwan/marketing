import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST, DELETE } from "./route";

vi.mock("@/lib/db", () => ({
  prisma: {
    contentSchedule: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    contentPiece: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/config", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/auth/workspace", () => ({
  getCurrentWorkspace: vi.fn(),
}));

vi.mock("@/lib/notifications/trigger", () => ({
  notifyContentStatus: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { notifyContentStatus } from "@/lib/notifications/trigger";

describe("/api/content/[id]/schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET - Fetch schedule", () => {
    it("should return the first schedule", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1", role: "member" });
      (prisma.contentPiece.findFirst as any).mockResolvedValue({
        id: "content1",
        schedules: [{ id: "schedule1", status: "scheduled" }],
      });

      const response = await GET(
        {} as Request,
        { params: Promise.resolve({ id: "content1" }) }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe("schedule1");
    });

    it("should return 404 when content does not belong to the workspace", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1", role: "member" });
      (prisma.contentPiece.findFirst as any).mockResolvedValue(null);

      const response = await GET(
        {} as Request,
        { params: Promise.resolve({ id: "content1" }) }
      );

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error.code).toBe("content_not_found");
    });
  });

  describe("POST - Create schedule", () => {
    it("should create or update a schedule and notify the workspace", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1", role: "member" });
      (prisma.contentPiece.findFirst as any).mockResolvedValue({
        id: "content1",
        title: "Test Content",
        schedules: [],
      });
      (prisma.contentSchedule.upsert as any).mockResolvedValue({
        id: "schedule1",
        status: "scheduled",
      });
      (prisma.contentPiece.update as any).mockResolvedValue({});

      const request = {
        json: async () => ({ scheduledAt: "2025-01-01T10:00:00Z" }),
      } as Request;

      const response = await POST(request, {
        params: Promise.resolve({ id: "content1" }),
      });

      expect(response.status).toBe(201);
      expect(prisma.contentSchedule.upsert).toHaveBeenCalledWith({
        where: { contentId: "content1" },
        create: {
          contentId: "content1",
          scheduledAt: new Date("2025-01-01T10:00:00Z"),
          status: "scheduled",
        },
        update: {
          scheduledAt: new Date("2025-01-01T10:00:00Z"),
          status: "scheduled",
        },
      });
      expect(prisma.contentPiece.update).toHaveBeenCalledWith({
        where: { id: "content1" },
        data: { status: "scheduled" },
      });
      expect(notifyContentStatus).toHaveBeenCalledWith(
        "content1",
        "scheduled",
        "ws1"
      );
    });

    it("should validate required dates", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1", role: "member" });

      const request = {
        json: async () => ({}),
      } as Request;

      const response = await POST(request, {
        params: Promise.resolve({ id: "content1" }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe("missing_parameter");
    });

    it("should reject invalid dates", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1", role: "member" });

      const request = {
        json: async () => ({ scheduledAt: "not-a-date" }),
      } as Request;

      const response = await POST(request, {
        params: Promise.resolve({ id: "content1" }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe("invalid_parameter");
    });
  });

  describe("DELETE - Remove schedule", () => {
    it("should delete the schedule and return content to approved", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1", role: "member" });
      (prisma.contentPiece.findFirst as any).mockResolvedValue({
        id: "content1",
        schedules: [{ id: "schedule1" }],
      });
      (prisma.contentSchedule.deleteMany as any).mockResolvedValue({ count: 1 });
      (prisma.contentPiece.update as any).mockResolvedValue({});

      const response = await DELETE(
        {} as Request,
        { params: Promise.resolve({ id: "content1" }) }
      );

      expect(response.status).toBe(200);
      expect(prisma.contentPiece.update).toHaveBeenCalledWith({
        where: { id: "content1" },
        data: { status: "approved" },
      });
    });
  });
});
