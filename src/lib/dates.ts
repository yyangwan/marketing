/**
 * Date formatting utilities for calendar and scheduling features
 */

export const DISPLAY_TIME_ZONE = "Asia/Shanghai";

function getDateTimeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

/**
 * Format a date as "YYYY-MM-DD"
 */
export function formatDate(date: Date): string {
  const parts = getDateTimeParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Format a date-time as "YYYY-MM-DD HH:mm"
 */
export function formatDateTime(date: Date): string {
  const parts = getDateTimeParts(date);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

/** Parse a datetime-local value as a wall-clock time in Asia/Shanghai. */
export function parseShanghaiDateTime(value: string): Date {
  return new Date(`${value}:00+08:00`);
}

/**
 * Check if two dates are the same day (ignoring time)
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Get the first and last day of the month for a given date
 */
export function getMonthRange(date: Date): { start: Date; end: Date } {
  // Create a copy to avoid mutating the input
  const d = new Date(date);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

  return { start, end };
}

/**
 * Get the start and end of the week for a given date
 * Week starts on Monday (ISO standard)
 */
export function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date); // Create a copy to avoid mutating the input
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start

  // Create start date by computing the Monday directly, without mutation
  const start = new Date(d.getFullYear(), d.getMonth(), diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Parse a date string in "YYYY-MM-DD" format to a Date object
 */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Format a date as a relative time string (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return formatDate(date); // Fall back to absolute date for older dates
}
