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
    aITemplate: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";

describe("Templates Item API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/templates/[id]", () => {
    it("should return a single template by id", async () => {
      const mockTemplate = {
        id: "tpl1",
        name: "WeChat Article",
        workspaceId: "test-workspace-id",
        description: "Blog post template",
        template: "{title} - {body}",
        variables: '[]',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.aITemplate.findUnique as any).mockResolvedValue(mockTemplate);

      const response = await GET(
        {} as Request,
        { params: Promise.resolve({ id: "tpl1" }) } as any
      );

      const data = await response.json();

      expect(data).toMatchDateObject(mockTemplate);
      expect(prisma.aITemplate.findUnique).toHaveBeenCalledWith({
        where: { id: "tpl1" },
      });
    });

    it("should return 404 for non-existent template", async () => {
      (prisma.aITemplate.findUnique as any).mockResolvedValue(null);

      const response = await GET(
        {} as Request,
        { params: Promise.resolve({ id: "nonexistent" }) } as any
      );

      expect(response.status).toBe(404);
    });
  });

  describe("PUT /api/templates/[id]", () => {
    it("should update an existing template", async () => {
      const existing = {
        id: "tpl1",
        name: "Old Name",
        workspaceId: "test-workspace-id",
        description: "",
        template: "Old template",
        variables: '[]',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updated = {
        ...existing,
        name: "Updated Name",
      };

      (prisma.aITemplate.findUnique as any).mockResolvedValue(existing);
      (prisma.aITemplate.update as any).mockResolvedValue(updated);

      const response = await PUT(
        {
          json: async () => ({ name: "Updated Name", template: "New template", variables: [] }),
        } as Request,
        { params: Promise.resolve({ id: "tpl1" }) } as any
      );

      const data = await response.json();

      expect(data).toMatchDateObject(updated);
      expect(prisma.aITemplate.update).toHaveBeenCalled();
    });

    it("should return 404 for non-existent template", async () => {
      (prisma.aITemplate.findUnique as any).mockResolvedValue(null);

      const response = await PUT(
        {
          json: async () => ({ name: "Test", template: "Content", variables: [] }),
        } as Request,
        { params: Promise.resolve({ id: "nonexistent" }) } as any
      );

      expect(response.status).toBe(404);
    });

    it("should validate variable name format", async () => {
      const existing = {
        id: "tpl1",
        name: "Test",
        workspaceId: "test-workspace-id",
        description: "",
        template: "Template",
        variables: '[]',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.aITemplate.findUnique as any).mockResolvedValue(existing);

      const response = await PUT(
        {
          json: async () => ({
            name: "Test",
            template: "Content",
            variables: [{ name: "InvalidName", type: "text" }],
          }),
        } as Request,
        { params: Promise.resolve({ id: "tpl1" }) } as any
      );

      expect(response.status).toBe(400);
    });

    it("should validate variable type", async () => {
      const existing = {
        id: "tpl1",
        name: "Test",
        workspaceId: "test-workspace-id",
        description: "",
        template: "Template",
        variables: '[]',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.aITemplate.findUnique as any).mockResolvedValue(existing);

      const response = await PUT(
        {
          json: async () => ({
            name: "Test",
            template: "Content",
            variables: [{ name: "valid_name", type: "invalid" }],
          }),
        } as Request,
        { params: Promise.resolve({ id: "tpl1" }) } as any
      );

      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /api/templates/[id]", () => {
    it("should delete a template", async () => {
      const existing = {
        id: "tpl1",
        name: "Test",
        workspaceId: "test-workspace-id",
        description: "",
        template: "Template",
        variables: '[]',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.aITemplate.findUnique as any).mockResolvedValue(existing);
      (prisma.aITemplate.delete as any).mockResolvedValue(existing);

      const response = await DELETE(
        {} as Request,
        { params: Promise.resolve({ id: "tpl1" }) } as any
      );

      expect(response.status).toBe(200);
      expect(prisma.aITemplate.delete).toHaveBeenCalled();
    });
  });
});
