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

    expect(screen.queryByText("Schedule Content")).not.toBeInTheDocument();
  });

  it("should render when isOpen is true", () => {
    render(
      <ScheduleDialog
        isOpen={true}
        onClose={mockOnClose}
        onSchedule={mockOnSchedule}
      />
    );

    expect(screen.getByText("Schedule Content")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Time")).toBeInTheDocument();
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

    expect(screen.getByText(/Optimal for wechat/)).toBeInTheDocument();
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

    expect(screen.queryByText(/Optimal for/)).not.toBeInTheDocument();
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

    const scheduleButton = screen.getByText("Schedule");
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

    const cancelButton = screen.getByText("Cancel");
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

    expect(screen.getByText(/Scheduled for:/)).toBeInTheDocument();
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
