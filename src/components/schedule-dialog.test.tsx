import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import ScheduleDialog from "./schedule-dialog";
import "@testing-library/jest-dom";

describe("ScheduleDialog", () => {
  const mockOnSchedule = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when isOpen is false", () => {
    render(
      <ScheduleDialog
        isOpen={false}
        onClose={mockOnClose}
        onSchedule={mockOnSchedule}
      />
    );

    expect(screen.queryByText("排期内容")).not.toBeInTheDocument();
  });

  it("should render when isOpen is true", () => {
    render(
      <ScheduleDialog
        isOpen={true}
        onClose={mockOnClose}
        onSchedule={mockOnSchedule}
      />
    );

    expect(screen.getByText("排期内容")).toBeInTheDocument();
    expect(screen.getByText("日期")).toBeInTheDocument();
    expect(screen.getByText("时间")).toBeInTheDocument();
  });

  it("should render platform-specific optimal time", () => {
    render(
      <ScheduleDialog
        isOpen={true}
        onClose={mockOnClose}
        onSchedule={mockOnSchedule}
        platform="wechat"
      />
    );

    expect(screen.getByText(/wechat 最佳发布时间/)).toBeInTheDocument();
    expect(screen.getByText("08:00")).toBeInTheDocument();
  });

  it("should not show optimal time for unknown platform", () => {
    render(
      <ScheduleDialog
        isOpen={true}
        onClose={mockOnClose}
        onSchedule={mockOnSchedule}
        platform="unknown"
      />
    );

    expect(screen.queryByText(/最佳发布时间/)).not.toBeInTheDocument();
  });

  it("should call onSchedule when form is submitted", () => {
    const { container } = render(
      <ScheduleDialog
        isOpen={true}
        onClose={mockOnClose}
        onSchedule={mockOnSchedule}
      />
    );

    const dateInput = container.querySelector('input[type="date"]');
    if (dateInput) {
      fireEvent.change(dateInput, { target: { value: "2025-01-15" } });
    }

    const scheduleButton = screen.getByText("确认排期");
    fireEvent.click(scheduleButton);

    expect(mockOnSchedule).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("should call onClose when Cancel is clicked", () => {
    render(
      <ScheduleDialog
        isOpen={true}
        onClose={mockOnClose}
        onSchedule={mockOnSchedule}
      />
    );

    const cancelButton = screen.getByText("取消");
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
    expect(mockOnSchedule).not.toHaveBeenCalled();
  });

  it("should show preview when date is selected", () => {
    const { container } = render(
      <ScheduleDialog
        isOpen={true}
        onClose={mockOnClose}
        onSchedule={mockOnSchedule}
      />
    );

    const dateInput = container.querySelector('input[type="date"]');
    if (dateInput) {
      fireEvent.change(dateInput, { target: { value: "2025-01-15" } });
    }

    expect(screen.getByText(/计划发布时间/)).toBeInTheDocument();
  });

  it("should use platform default time", () => {
    const { container } = render(
      <ScheduleDialog
        isOpen={true}
        onClose={mockOnClose}
        onSchedule={mockOnSchedule}
        platform="xiaohongshu"
      />
    );

    const timeSelect = container.querySelector('select');
    expect(timeSelect?.value).toBe("20:00");
  });

  it("should have time options", () => {
    const { container } = render(
      <ScheduleDialog
        isOpen={true}
        onClose={mockOnClose}
        onSchedule={mockOnSchedule}
      />
    );

    const timeSelect = container.querySelector('select');
    expect(timeSelect).toBeInTheDocument();
    expect(timeSelect?.tagName).toBe("SELECT");
  });
});
