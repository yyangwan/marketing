import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST, GET } from "./route";

// Custom matcher for date comparison (handles arrays and objects)
expect.extend({
  toMatchDateObject(received: any, expected: any) {
    // Handle arrays
    if (Array.isArray(received) && Array.isArray(expected)) {
      const receivedWithoutDates = received.map((item: any) => {
        const { createdAt, updatedAt, ...rest } = item;
        return rest;
      });
      const expectedWithoutDates = expected.map((item: any) => {
        const { createdAt, updatedAt, ...rest } = item;
        return rest;
      });

      const pass = this.equals(receivedWithoutDates, expectedWithoutDates);
      return {
        pass,
        message: () =>
          pass
            ? "Expected dates to match (ignoring exact millisecond differences)"
            : `Expected objects to match (excluding dates):\n${JSON.stringify(expectedWithoutDates)}\n\nReceived:\n${JSON.stringify(receivedWithoutDates)}`,
      };
    }

    // Handle single objects
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
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";

describe("Brand Voices API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/brand-voices", () => {
    it("should return list of brand voices for workspace", async () => {
      const mockBrandVoices = [
        {
          id: "bv1",
          name: "Test Brand",
          workspaceId: "test-workspace-id",
          description: "Test description",
          guidelines: "Test guidelines",
          samples: '["sample1", "sample2"]',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.brandVoice.findMany as any).mockResolvedValue(mockBrandVoices);

      const response = await GET();
      const data = await response.json();

      expect(data).toMatchDateObject(mockBrandVoices);
      expect(prisma.brandVoice.findMany).toHaveBeenCalledWith({
        where: { workspaceId: "test-workspace-id" },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("POST /api/brand-voices", () => {
    it("should create a brand voice with valid data", async () => {
      const newBrandVoice = {
        id: "bv1",
        name: "New Brand",
        workspaceId: "test-workspace-id",
        description: "",
        guidelines: "",
        samples: '["sample1"]',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.brandVoice.create as any).mockResolvedValue(newBrandVoice);

      const requestBody = {
        name: "New Brand",
        description: "Description",
        guidelines: "Guidelines",
        samples: ["sample1"],
      };

      const response = await POST({
        json: async () => requestBody,
      } as Request);

      const data = await response.json();

      expect(data).toMatchDateObject(newBrandVoice);
      expect(prisma.brandVoice.create).toHaveBeenCalledWith({
        data: {
          name: "New Brand",
          description: "Description",
          guidelines: "Guidelines",
          samples: '["sample1"]',
          workspaceId: "test-workspace-id",
        },
      });
    });

    it("should reject brand voice with no samples", async () => {
      const response = await POST({
        json: async () => ({
          name: "Test",
          samples: [],
        }),
      } as Request);

      expect(response.status).toBe(400);
    });

    it("should reject brand voice with more than 5 samples", async () => {
      const response = await POST({
        json: async () => ({
          name: "Test",
          samples: Array(6).fill("sample"),
        }),
      } as Request);

      expect(response.status).toBe(400);
    });

    it("should reject brand voice with sample exceeding 2500 characters", async () => {
      const response = await POST({
        json: async () => ({
          name: "Test",
          samples: ["a".repeat(2501)],
        }),
      } as Request);

      expect(response.status).toBe(400);
    });
  });

});
