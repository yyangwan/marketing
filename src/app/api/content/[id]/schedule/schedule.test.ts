import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST, DELETE } from "./route";

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

  describe("POST - Create schedule", () => {
    it("should create a new schedule", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockWs = { workspaceId: "ws1" };
      const mockContent = { id: "content1", title: "Test Content" };
      const mockSchedule = { id: "schedule1" };

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(mockWs);
      (prisma.contentPiece.findFirst as any).mockResolvedValue(mockContent);
      (prisma.contentSchedule.findFirst as any).mockResolvedValue(null);
      (prisma.contentSchedule.create as any).mockResolvedValue(mockSchedule);
      (prisma.contentPiece.update as any).mockResolvedValue({});
      (prisma.notification.create as any).mockResolvedValue({});

      const request = new Request("http://localhost:3000/api/content/content1/schedule", {
        method: "POST",
        body: JSON.stringify({ scheduledAt: "2025-01-01T10:00:00Z" }),
      });

      const response = await POST(request, { params: { id: "content1" } });

      expect(response.status).toBe(201);
      expect(prisma.contentSchedule.create).toHaveBeenCalled();
    });

    it("should return 401 for unauthorized requests", async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const request = new Request("http://localhost:3000/api/content/content1/schedule", {
        method: "POST",
        body: JSON.stringify({ scheduledAt: "2025-01-01T10:00:00Z" }),
      });

      const response = await POST(request, { params: { id: "content1" } });

      expect(response.status).toBe(401);
    });

    it("should return 400 for missing scheduledAt", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const request = new Request("http://localhost:3000/api/content/content1/schedule", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await POST(request, { params: { id: "content1" } });

      expect(response.status).toBe(400);
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

      const request = new Request("http://localhost:3000/api/content/content1/schedule", {
        method: "DELETE",
      });

      const response = await DELETE(request, { params: { id: "content1" } });

      expect(response.status).toBe(200);
      expect(prisma.contentSchedule.deleteMany).toHaveBeenCalled();
    });
  });
});
