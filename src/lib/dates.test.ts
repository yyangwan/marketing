import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  formatDate,
  formatDateTime,
  isSameDay,
  getMonthRange,
  getWeekRange,
  parseDate,
  addDays,
  formatRelativeTime,
} from "./dates";

describe("Date Utilities", () => {
  describe("formatDate", () => {
    it("should format date as YYYY-MM-DD", () => {
      // Use UTC date to avoid timezone issues
      const date = new Date(Date.UTC(2025, 0, 15, 10, 30, 0));
      const result = formatDate(date);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result).toContain("2025-01-15");
    });

    it("should pad single digit month and day", () => {
      const date = new Date(Date.UTC(2025, 0, 5, 10, 30, 0));
      const result = formatDate(date);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should handle December", () => {
      const date = new Date(Date.UTC(2025, 11, 31, 10, 30, 0));
      const result = formatDate(date);
      expect(result).toContain("2025-12-31");
    });
  });

  describe("formatDateTime", () => {
    it("should format date-time as YYYY-MM-DD HH:mm", () => {
      const date = new Date(Date.UTC(2025, 0, 15, 10, 30, 0));
      const result = formatDateTime(date);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });

    it("should pad single digit hours and minutes", () => {
      const date = new Date(Date.UTC(2025, 0, 15, 9, 5, 0));
      const result = formatDateTime(date);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });

    it("should handle midnight", () => {
      const date = new Date(Date.UTC(2025, 0, 15, 0, 0, 0));
      const result = formatDateTime(date);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });

    it("should handle end of day", () => {
      const date = new Date(Date.UTC(2025, 0, 15, 23, 59, 0));
      const result = formatDateTime(date);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });
  });

  describe("isSameDay", () => {
    it("should return true for same day different times", () => {
      const date1 = new Date(2025, 0, 15, 10, 0, 0);
      const date2 = new Date(2025, 0, 15, 18, 30, 0);
      expect(isSameDay(date1, date2)).toBe(true);
    });

    it("should return false for different days", () => {
      const date1 = new Date(2025, 0, 15, 10, 0, 0);
      const date2 = new Date(2025, 0, 16, 10, 0, 0);
      expect(isSameDay(date1, date2)).toBe(false);
    });

    it("should return false for different months", () => {
      const date1 = new Date(2025, 0, 15, 10, 0, 0);
      const date2 = new Date(2025, 1, 15, 10, 0, 0);
      expect(isSameDay(date1, date2)).toBe(false);
    });

    it("should return false for different years", () => {
      const date1 = new Date(2025, 0, 15, 10, 0, 0);
      const date2 = new Date(2026, 0, 15, 10, 0, 0);
      expect(isSameDay(date1, date2)).toBe(false);
    });
  });

  describe("getMonthRange", () => {
    it("should return start and end of month", () => {
      const date = new Date(2025, 0, 15, 10, 0, 0);
      const range = getMonthRange(date);

      expect(range.start.getFullYear()).toBe(2025);
      expect(range.start.getMonth()).toBe(0);
      expect(range.start.getDate()).toBe(1);
      expect(range.start.getHours()).toBe(0);

      expect(range.end.getMonth()).toBe(0);
      expect(range.end.getDate()).toBe(31);
    });

    it("should handle February in non-leap year", () => {
      const date = new Date(2025, 1, 15, 10, 0, 0);
      const range = getMonthRange(date);

      expect(range.start.getMonth()).toBe(1);
      expect(range.start.getDate()).toBe(1);
      expect(range.end.getMonth()).toBe(1);
      expect(range.end.getDate()).toBe(28);
    });

    it("should handle February in leap year", () => {
      const date = new Date(2024, 1, 15, 10, 0, 0);
      const range = getMonthRange(date);

      expect(range.start.getMonth()).toBe(1);
      expect(range.start.getDate()).toBe(1);
      expect(range.end.getMonth()).toBe(1);
      expect(range.end.getDate()).toBe(29);
    });

    it("should handle December", () => {
      const date = new Date(2025, 11, 15, 10, 0, 0);
      const range = getMonthRange(date);

      expect(range.start.getMonth()).toBe(11);
      expect(range.start.getDate()).toBe(1);
      expect(range.end.getMonth()).toBe(11);
      expect(range.end.getDate()).toBe(31);
    });

    it("should handle month with 30 days", () => {
      const date = new Date(2025, 3, 15, 10, 0, 0);
      const range = getMonthRange(date);

      expect(range.start.getMonth()).toBe(3);
      expect(range.start.getDate()).toBe(1);
      expect(range.end.getMonth()).toBe(3);
      expect(range.end.getDate()).toBe(30);
    });
  });

  describe("getWeekRange", () => {
    it("should return start (Monday) and end (Sunday) of week", () => {
      // Jan 15, 2025 is a Wednesday
      const date = new Date(2025, 0, 15, 10, 0, 0);
      const range = getWeekRange(date);

      // Should be almost a 7-day range (6.999... due to end being 23:59:59.999)
      const diff = (range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24);
      expect(diff).toBeGreaterThan(6);
      expect(diff).toBeLessThan(7);

      // Start should be at midnight
      expect(range.start.getHours()).toBe(0);
      expect(range.start.getMinutes()).toBe(0);

      // End should be at end of day
      expect(range.end.getHours()).toBe(23);
      expect(range.end.getMinutes()).toBe(59);
    });

    it("should handle Monday", () => {
      const date = new Date(2025, 0, 13, 10, 0, 0); // Monday
      const range = getWeekRange(date);

      // Monday should be the start of the week
      expect(range.start.getHours()).toBe(0);
      expect(range.start.getMinutes()).toBe(0);
    });

    it("should handle Sunday", () => {
      const date = new Date(2025, 0, 19, 10, 0, 0); // Sunday
      const range = getWeekRange(date);

      // Sunday should be the end of the week
      expect(range.end.getHours()).toBe(23);
      expect(range.end.getMinutes()).toBe(59);
    });

    it("should handle week spanning month boundary", () => {
      const date = new Date(2025, 1, 1, 10, 0, 0); // Saturday
      const range = getWeekRange(date);

      // Range should be almost 7 days (6.999... due to end being 23:59:59.999)
      const diff = (range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24);
      expect(diff).toBeGreaterThan(6);
      expect(diff).toBeLessThan(7);
    });
  });

  describe("parseDate", () => {
    it("should parse valid date string", () => {
      const result = parseDate("2025-01-15");
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(15);
    });

    it("should handle single digit month", () => {
      const result = parseDate("2025-01-05");
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(5);
    });

    it("should handle double digit month", () => {
      const result = parseDate("2025-12-31");
      expect(result.getMonth()).toBe(11);
      expect(result.getDate()).toBe(31);
    });

    it("should create date at midnight in local timezone", () => {
      const result = parseDate("2025-01-15");
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });
  });

  describe("addDays", () => {
    it("should add positive days", () => {
      const date = new Date(2025, 0, 15, 10, 0, 0);
      const result = addDays(date, 5);
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(20);
    });

    it("should add negative days", () => {
      const date = new Date(2025, 0, 15, 10, 0, 0);
      const result = addDays(date, -3);
      expect(result.getDate()).toBe(12);
    });

    it("should handle zero days", () => {
      const date = new Date(2025, 0, 15, 10, 0, 0);
      const result = addDays(date, 0);
      expect(result.getDate()).toBe(15);
    });

    it("should handle month boundary", () => {
      const date = new Date(2025, 0, 30, 10, 0, 0);
      const result = addDays(date, 5);
      expect(result.getMonth()).toBe(1);
      expect(result.getDate()).toBe(4);
    });

    it("should not mutate original date", () => {
      const date = new Date(2025, 0, 15, 10, 0, 0);
      const originalTime = date.getTime();
      addDays(date, 5);
      expect(date.getTime()).toBe(originalTime);
    });
  });

  describe("formatRelativeTime", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 0, 15, 12, 0, 0));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return 'just now' for less than 60 seconds", () => {
      const date = new Date(2025, 0, 15, 11, 59, 30);
      expect(formatRelativeTime(date)).toBe("just now");
    });

    it("should return minutes for less than an hour", () => {
      const date = new Date(2025, 0, 15, 11, 45, 0);
      expect(formatRelativeTime(date)).toBe("15 minutes ago");
    });

    it("should return singular minute for 1 minute", () => {
      const date = new Date(2025, 0, 15, 11, 59, 0);
      expect(formatRelativeTime(date)).toBe("1 minute ago");
    });

    it("should return hours for less than a day", () => {
      const date = new Date(2025, 0, 15, 8, 0, 0);
      expect(formatRelativeTime(date)).toBe("4 hours ago");
    });

    it("should return singular hour for 1 hour", () => {
      const date = new Date(2025, 0, 15, 11, 0, 0);
      expect(formatRelativeTime(date)).toBe("1 hour ago");
    });

    it("should return days for less than a week", () => {
      const date = new Date(2025, 0, 13, 12, 0, 0);
      expect(formatRelativeTime(date)).toBe("2 days ago");
    });

    it("should return singular day for 1 day", () => {
      const date = new Date(2025, 0, 14, 12, 0, 0);
      expect(formatRelativeTime(date)).toBe("1 day ago");
    });

    it("should return formatted date for older than 7 days", () => {
      const date = new Date(2025, 0, 1, 12, 0, 0);
      expect(formatRelativeTime(date)).toBe("2025-01-01");
    });

    it("should return formatted date for 7 days or more", () => {
      const date = new Date(2025, 0, 8, 12, 0, 0); // Exactly 7 days
      expect(formatRelativeTime(date)).toBe("2025-01-08");
    });
  });
});
