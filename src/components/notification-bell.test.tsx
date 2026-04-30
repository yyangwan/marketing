import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NotificationBell from "./notification-bell";
import "@testing-library/jest-dom";
import { toast } from "sonner";

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

// Mock router
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}));

describe("NotificationBell", () => {
  const mockWorkspaceId = "ws1";

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("should render bell icon", () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    render(<NotificationBell workspaceId={mockWorkspaceId} />);

    // Bell icon should be rendered (lucide Bell component)
    const bell = document.querySelector(".lucide-bell");
    expect(bell).toBeInTheDocument();
  });

  it("should fetch notifications on mount", async () => {
    const mockNotifications = [
      {
        id: "n1",
        type: "content_review",
        title: "Review Needed",
        message: "Please review this content",
        isRead: false,
        createdAt: "2025-01-15T10:00:00Z",
      },
    ];

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockNotifications,
    });

    render(<NotificationBell workspaceId={mockWorkspaceId} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/notifications?workspaceId=${mockWorkspaceId}&limit=10`
      );
    });
  });

  it("should display unread count badge", async () => {
    const mockNotifications = [
      { id: "n1", type: "test", title: "Test", message: "Test", isRead: false, createdAt: "2025-01-15T10:00:00Z" },
      { id: "n2", type: "test", title: "Test", message: "Test", isRead: false, createdAt: "2025-01-15T10:00:00Z" },
      { id: "n3", type: "test", title: "Test", message: "Test", isRead: true, createdAt: "2025-01-15T10:00:00Z" },
    ];

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockNotifications,
    });

    render(<NotificationBell workspaceId={mockWorkspaceId} />);

    await waitFor(() => {
      const badge = screen.getByText("2");
      expect(badge).toBeInTheDocument();
    });
  });

  it("should show 9+ for 10 or more unread", async () => {
    const mockNotifications = Array.from({ length: 10 }, (_, i) => ({
      id: `n${i}`,
      type: "test",
      title: "Test",
      message: "Test",
      isRead: false,
      createdAt: "2025-01-15T10:00:00Z",
    }));

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockNotifications,
    });

    render(<NotificationBell workspaceId={mockWorkspaceId} />);

    await waitFor(() => {
      const badge = screen.getByText("9+");
      expect(badge).toBeInTheDocument();
    });
  });

  it("should open dropdown when bell is clicked", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    render(<NotificationBell workspaceId={mockWorkspaceId} />);

    const button = document.querySelector("button") as HTMLElement;
    fireEvent.click(button);

    // Should show dropdown with "通知" heading
    await waitFor(() => {
      expect(screen.getByText("通知")).toBeInTheDocument();
    });
  });

  it("should display no notifications message when empty", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    render(<NotificationBell workspaceId={mockWorkspaceId} />);

    const button = document.querySelector("button") as HTMLElement;
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("暂无通知")).toBeInTheDocument();
    });
  });

  it("should display notifications in dropdown", async () => {
    const mockNotifications = [
      {
        id: "n1",
        type: "content_review",
        title: "Review Needed",
        message: "Please review this content",
        isRead: false,
        createdAt: "2025-01-15T10:00:00Z",
      },
    ];

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockNotifications,
    });

    render(<NotificationBell workspaceId={mockWorkspaceId} />);

    const button = document.querySelector("button") as HTMLElement;
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Review Needed")).toBeInTheDocument();
      expect(screen.getByText("Please review this content")).toBeInTheDocument();
    });
  });

  it("should show toast error when fetch fails", async () => {
    (global.fetch as any).mockRejectedValue(new Error("Network error"));

    render(<NotificationBell workspaceId={mockWorkspaceId} />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to load notifications");
    });
  });

  it("should show toast error when fetch returns non-ok response", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
    });

    render(<NotificationBell workspaceId={mockWorkspaceId} />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to load notifications");
    });
  });

  it("should mark all as read when button is clicked", async () => {
    const mockNotifications = [
      { id: "n1", type: "test", title: "Test", message: "Test", isRead: false, createdAt: "2025-01-15T10:00:00Z" },
    ];

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockNotifications,
      })
      .mockResolvedValueOnce({
        ok: true,
      });

    render(<NotificationBell workspaceId={mockWorkspaceId} />);

    // Open dropdown
    const button = document.querySelector("button") as HTMLElement;
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("全部标为已读")).toBeInTheDocument();
    });

    // Click mark all as read
    const markAllButton = screen.getByText("全部标为已读");
    fireEvent.click(markAllButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/notifications/mark-all-read", {
        method: "POST",
      });
    });
  });

  it("should show toast error when mark all as read fails", async () => {
    const mockNotifications = [
      { id: "n1", type: "test", title: "Test", message: "Test", isRead: false, createdAt: "2025-01-15T10:00:00Z" },
    ];

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockNotifications,
      })
      .mockRejectedValueOnce(new Error("Network error"));

    render(<NotificationBell workspaceId={mockWorkspaceId} />);

    // Open dropdown and click mark all as read
    const button = document.querySelector("button") as HTMLElement;
    fireEvent.click(button);

    await waitFor(() => {
      const markAllButton = screen.getByText("全部标为已读");
      fireEvent.click(markAllButton);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to mark all as read");
    });
  });

  it("should close dropdown when clicking outside", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    render(<NotificationBell workspaceId={mockWorkspaceId} />);

    // Open dropdown
    const button = document.querySelector("button") as HTMLElement;
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("通知")).toBeInTheDocument();
    });

    // Close dropdown
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.queryByText("通知")).not.toBeInTheDocument();
    });
  });
});
