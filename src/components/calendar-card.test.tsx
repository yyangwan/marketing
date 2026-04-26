import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CalendarCard from "./calendar-card";
import "@testing-library/jest-dom";

describe("CalendarCard", () => {
  const mockOnClick = vi.fn();
  const mockOnDragStart = vi.fn();

  const defaultProps = {
    id: "c1",
    title: "Test Content",
    platform: "wechat",
    status: "scheduled" as const,
    scheduledAt: "2025-01-15T10:00:00Z",
    onClick: mockOnClick,
    onDragStart: mockOnDragStart,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render card content", () => {
    render(<CalendarCard {...defaultProps} />);

    expect(screen.getByText("Test Content")).toBeInTheDocument();
    expect(screen.getByText("wechat")).toBeInTheDocument();
  });

  it("should render scheduled status with blue color", () => {
    const { container } = render(<CalendarCard {...defaultProps} />);

    const element = container.querySelector(".rounded");
    expect(element?.className).toContain("bg-blue-100");
  });

  it("should render publishing status with yellow color", () => {
    const props = { ...defaultProps, status: "publishing" as const };
    const { container } = render(<CalendarCard {...props} />);

    const element = container.querySelector(".rounded");
    expect(element?.className).toContain("bg-yellow-100");
  });

  it("should render published status with green color", () => {
    const props = { ...defaultProps, status: "published" as const };
    const { container } = render(<CalendarCard {...props} />);

    const element = container.querySelector(".rounded");
    expect(element?.className).toContain("bg-green-100");
  });

  it("should render failed status with red color", () => {
    const props = { ...defaultProps, status: "failed" as const };
    const { container } = render(<CalendarCard {...props} />);

    const element = container.querySelector(".rounded");
    expect(element?.className).toContain("bg-red-100");
  });

  it("should render time", () => {
    render(<CalendarCard {...defaultProps} />);

    // Check that some time element is rendered
    const timeElement = screen.queryByText((content, element) => {
      return element?.tagName === "SPAN" && /\d{1,2}/.test(content || "");
    });
    expect(timeElement).toBeInTheDocument();
  });

  it("should not render platform when not provided", () => {
    const props = { ...defaultProps, platform: undefined };
    render(<CalendarCard {...props} />);

    expect(screen.queryByText("wechat")).not.toBeInTheDocument();
  });

  it("should call onClick when clicked", () => {
    render(<CalendarCard {...defaultProps} />);

    const element = screen.getByText("Test Content").closest("div");
    fireEvent.click(element!);

    expect(mockOnClick).toHaveBeenCalled();
  });

  it("should call onDragStart when dragged", () => {
    render(<CalendarCard {...defaultProps} />);

    const element = screen.getByText("Test Content").closest("div");
    fireEvent.dragStart(element!);

    expect(mockOnDragStart).toHaveBeenCalled();
  });

  it("should be draggable", () => {
    const { container } = render(<CalendarCard {...defaultProps} />);

    const element = container.querySelector(".rounded");
    expect(element?.getAttribute("draggable")).toBe("true");
  });
});
