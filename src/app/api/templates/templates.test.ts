import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";

// Custom matcher for date comparison
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
    aITemplate: {
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

describe("Templates API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/templates", () => {
    it("should return list of templates for workspace", async () => {
      const mockTemplates = [
        {
          id: "tpl1",
          name: "WeChat Article",
          workspaceId: "test-workspace-id",
          description: "Blog post template",
          template: "{title} - {body}",
          variables: '[]',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.aITemplate.findMany as any).mockResolvedValue(mockTemplates);

      const response = await GET();
      const data = await response.json();

      expect(data).toMatchDateObject(mockTemplates);
      expect(prisma.aITemplate.findMany).toHaveBeenCalledWith({
        where: { workspaceId: "test-workspace-id" },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("POST /api/templates", () => {
    it("should create a template with valid data", async () => {
      const newTemplate = {
        id: "tpl1",
        name: "Test Template",
        workspaceId: "test-workspace-id",
        description: "Test description",
        template: "{keyword} article",
        variables: '[]',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.aITemplate.create as any).mockResolvedValue(newTemplate);

      const requestBody = {
        name: "Test Template",
        description: "Test description",
        template: "{keyword} article",
        variables: [],
      };

      const response = await POST({
        json: async () => requestBody,
      } as Request);

      const data = await response.json();

      expect(data).toMatchDateObject(newTemplate);
      expect(prisma.aITemplate.create).toHaveBeenCalledWith({
        data: {
          name: "Test Template",
          description: "Test description",
          template: "{keyword} article",
          variables: "[]",
          workspaceId: "test-workspace-id",
        },
      });
    });

    it("should reject template with invalid variable name (uppercase)", async () => {
      const response = await POST({
        json: async () => ({
          name: "Test",
          template: "Content",
          variables: [{ name: "InvalidName", type: "text" }],
        }),
      } as Request);

      expect(response.status).toBe(400);
    });

    it("should reject template with invalid variable name (special chars)", async () => {
      const response = await POST({
        json: async () => ({
          name: "Test",
          template: "Content",
          variables: [{ name: "invalid-name", type: "text" }],
        }),
      } as Request);

      expect(response.status).toBe(400);
    });

    it("should reject template with invalid variable type", async () => {
      const response = await POST({
        json: async () => ({
          name: "Test",
          template: "Content",
          variables: [{ name: "valid_name", type: "invalid" }],
        }),
      } as Request);

      expect(response.status).toBe(400);
    });
  });

});

