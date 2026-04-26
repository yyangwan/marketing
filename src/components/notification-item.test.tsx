import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NotificationItem from "./notification-item";
import "@testing-library/jest-dom";

describe("NotificationItem", () => {
  const mockOnClick = vi.fn();
  const mockNotification = {
    id: "n1",
    type: "content_review",
    title: "Review Needed",
    message: "Please review this content",
    link: "/content/c1",
    isRead: false,
    createdAt: "2025-01-15T10:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render notification", () => {
    render(
      <NotificationItem
        notification={mockNotification}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText("Review Needed")).toBeInTheDocument();
    expect(screen.getByText("Please review this content")).toBeInTheDocument();
  });

  it("should render correct icon for content_review", () => {
    render(
      <NotificationItem
        notification={mockNotification}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText("👀")).toBeInTheDocument();
  });

  it("should render correct icon for content_approved", () => {
    const notification = { ...mockNotification, type: "content_approved" };
    render(
      <NotificationItem
        notification={notification}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText("✅")).toBeInTheDocument();
  });

  it("should render correct icon for content_published", () => {
    const notification = { ...mockNotification, type: "content_published" };
    render(
      <NotificationItem
        notification={notification}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText("🚀")).toBeInTheDocument();
  });

  it("should render correct icon for schedule_reminder", () => {
    const notification = { ...mockNotification, type: "schedule_reminder" };
    render(
      <NotificationItem
        notification={notification}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText("📅")).toBeInTheDocument();
  });

  it("should render correct icon for mention", () => {
    const notification = { ...mockNotification, type: "mention" };
    render(
      <NotificationItem
        notification={notification}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText("💬")).toBeInTheDocument();
  });

  it("should render default icon for unknown type", () => {
    const notification = { ...mockNotification, type: "unknown" };
    render(
      <NotificationItem
        notification={notification}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText("🔔")).toBeInTheDocument();
  });

  it("should highlight unread notifications", () => {
    const { container } = render(
      <NotificationItem
        notification={mockNotification}
        onClick={mockOnClick}
      />
    );

    // Find the outer div with the hover:bg-gray-50 class
    const element = container.querySelector(".hover\\:bg-gray-50");
    expect(element?.className).toContain("bg-blue-50");
  });

  it("should not highlight read notifications", () => {
    const notification = { ...mockNotification, isRead: true };
    const { container } = render(
      <NotificationItem
        notification={notification}
        onClick={mockOnClick}
      />
    );

    const element = container.querySelector(".hover\\:bg-gray-50");
    expect(element?.className).not.toContain("bg-blue-50");
  });

  it("should call onClick when clicked", () => {
    render(
      <NotificationItem
        notification={mockNotification}
        onClick={mockOnClick}
      />
    );

    const element = screen.getByText("Review Needed").closest("div");
    if (element) fireEvent.click(element);

    expect(mockOnClick).toHaveBeenCalledWith(mockNotification);
  });

  it("should render relative time", () => {
    render(
      <NotificationItem
        notification={mockNotification}
        onClick={mockOnClick}
      />
    );

    // Just check that time element is rendered
    const timeElement = screen.queryByText((content, element) => {
      return element?.tagName.toLowerCase() === "p" && element?.className.includes("text-gray-400");
    });
    expect(timeElement).toBeInTheDocument();
  });
});
