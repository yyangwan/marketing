import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, PUT, DELETE } from "./route";

// Custom matcher for date comparison
expect.extend({
  toMatchDateObject(received: any, expected: any) {
    const receivedWithoutDates = { ...received };
    const expectedWithoutDates = { ...expected };
    delete receivedWithoutDates.createdAt;
    delete receivedWithoutDates.updatedAt;
    delete expectedWithoutDates.createdAt;
    delete expectedWithoutDates.updatedAt;

    const pass = this.equals(receivedWithoutDates, expectedWithoutDates);
    return {
      pass,
      message: () =>
        pass
          ? "Expected dates to match (ignoring exact millisecond differences)"
          : `Expected objects to match (excluding dates):\n${JSON.stringify(expectedWithoutDates)}\n\nReceived:\n${JSON.stringify(receivedWithoutDates)}`,
    };
  },
});

// Mock the auth and workspace functions
vi.mock("@/lib/auth/config", () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: "test-user-id", workspaceId: "test-workspace-id" },
    })
  ),
}));

vi.mock("@/lib/auth/workspace", () => ({
  getCurrentWorkspace: vi.fn(() => ({ workspaceId: "test-workspace-id" })),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    brandVoice: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";

describe("Brand Voice Item API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/brand-voices/[id]", () => {
    it("should return a single brand voice by id", async () => {
      const mockBrandVoice = {
        id: "bv1",
        name: "Test Brand",
        workspaceId: "test-workspace-id",
        description: "Test description",
        guidelines: "Test guidelines",
        samples: '["sample1", "sample2"]',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.brandVoice.findUnique as any).mockResolvedValue(mockBrandVoice);

      const response = await GET(
        {} as Request,
        { params: Promise.resolve({ id: "bv1" }) } as any
      );

      const data = await response.json();

      expect(data).toMatchDateObject(mockBrandVoice);
      expect(prisma.brandVoice.findUnique).toHaveBeenCalledWith({
        where: { id: "bv1" },
      });
    });

    it("should return 404 for non-existent brand voice", async () => {
      (prisma.brandVoice.findUnique as any).mockResolvedValue(null);

      const response = await GET(
        {} as Request,
        { params: Promise.resolve({ id: "nonexistent" }) } as any
      );

      expect(response.status).toBe(404);
    });

    it("should return 404 for brand voice from different workspace", async () => {
      const mockBrandVoice = {
        id: "bv1",
        name: "Test Brand",
        workspaceId: "different-workspace-id",
        description: "",
        guidelines: "",
        samples: '["sample1"]',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.brandVoice.findUnique as any).mockResolvedValue(mockBrandVoice);

      const response = await GET(
        {} as Request,
        { params: Promise.resolve({ id: "bv1" }) } as any
      );

      expect(response.status).toBe(404);
    });
  });

  describe("PUT /api/brand-voices/[id]", () => {
    it("should update an existing brand voice", async () => {
      const existing = {
        id: "bv1",
        name: "Old Name",
        workspaceId: "test-workspace-id",
        description: "",
        guidelines: "",
        samples: '["sample1"]',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updated = {
        ...existing,
        name: "Updated Name",
      };

      (prisma.brandVoice.findUnique as any).mockResolvedValue(existing);
      (prisma.brandVoice.update as any).mockResolvedValue(updated);

      const response = await PUT(
        {
          json: async () => ({ name: "Updated Name", samples: ["sample1"] }),
        } as Request,
        { params: Promise.resolve({ id: "bv1" }) } as any
      );

      const data = await response.json();

      expect(data).toMatchDateObject(updated);
      expect(prisma.brandVoice.update).toHaveBeenCalled();
    });

    it("should return 404 for non-existent brand voice", async () => {
      (prisma.brandVoice.findUnique as any).mockResolvedValue(null);

      const response = await PUT(
        {
          json: async () => ({ name: "Test", samples: ["sample1"] }),
        } as Request,
        { params: Promise.resolve({ id: "nonexistent" }) } as any
      );

      expect(response.status).toBe(404);
    });

    it("should validate sample count (max 5)", async () => {
      const existing = {
        id: "bv1",
        name: "Test",
        workspaceId: "test-workspace-id",
        description: "",
        guidelines: "",
        samples: '["sample1"]',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.brandVoice.findUnique as any).mockResolvedValue(existing);

      const response = await PUT(
        {
          json: async () => ({
            name: "Test",
            samples: Array(6).fill("sample"),
          }),
        } as Request,
        { params: Promise.resolve({ id: "bv1" }) } as any
      );

      expect(response.status).toBe(400);
    });

    it("should validate total sample length (max 2500 chars)", async () => {
      const existing = {
        id: "bv1",
        name: "Test",
        workspaceId: "test-workspace-id",
        description: "",
        guidelines: "",
        samples: '["sample1"]',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.brandVoice.findUnique as any).mockResolvedValue(existing);

      const response = await PUT(
        {
          json: async () => ({
            name: "Test",
            samples: ["a".repeat(2501)],
          }),
        } as Request,
        { params: Promise.resolve({ id: "bv1" }) } as any
      );

      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /api/brand-voices/[id]", () => {
    it("should delete a brand voice", async () => {
      const existing = {
        id: "bv1",
        name: "Test",
        workspaceId: "test-workspace-id",
        description: "",
        guidelines: "",
        samples: '["sample1"]',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: {
          projects: 0,
          contentPieces: 0,
        },
      };

      (prisma.brandVoice.findUnique as any).mockResolvedValue(existing);
      (prisma.brandVoice.delete as any).mockResolvedValue(existing);

      const response = await DELETE(
        {} as Request,
        { params: Promise.resolve({ id: "bv1" }) } as any
      );

      expect(response.status).toBe(200);
      expect(prisma.brandVoice.delete).toHaveBeenCalled();
    });

    it("should return 409 when brand voice is in use", async () => {
      const existing = {
        id: "bv1",
        name: "Test",
        workspaceId: "test-workspace-id",
        description: "",
        guidelines: "",
        samples: '["sample1"]',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: {
          projects: 1,
          contentPieces: 0,
        },
      };

      (prisma.brandVoice.findUnique as any).mockResolvedValue(existing);

      const response = await DELETE(
        {} as Request,
        { params: Promise.resolve({ id: "bv1" }) } as any
      );

      expect(response.status).toBe(409);
    });
  });
});
