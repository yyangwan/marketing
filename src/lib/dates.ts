/**
 * Date formatting utilities for calendar and scheduling features
 */

/**
 * Format a date as "YYYY-MM-DD"
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a date-time as "YYYY-MM-DD HH:mm"
 */
export function formatDateTime(date: Date): string {
  const datePart = formatDate(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${datePart} ${hours}:${minutes}`;
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
 * Includes extra days before and after to account for calendar grid display
 */
export function getMonthRange(date: Date): { start: Date; end: Date } {
  const year = date.getFullYear();
  const month = date.getMonth();

  // First day of the month
  const firstDay = new Date(year, month, 1);

  // Get the day of week for the first day (0 = Sunday)
  const firstDayOfWeek = firstDay.getDay();

  // Calculate start date (include days from previous month to fill the first week)
  // For Monday start: if first day is Sunday (0), we need 6 days before; if Monday (1), 0 days before
  const start = new Date(year, month, 1 - firstDayOfWeek);
  start.setHours(0, 0, 0, 0);

  // Last day of the month
  const lastDay = new Date(year, month + 1, 0);

  // Get the day of week for the last day
  const lastDayOfWeek = lastDay.getDay();

  // Calculate end date (include days from next month to fill the last week)
  // For Monday start: if last day is Sunday (0), we need 0 days after; if Saturday (6), we need 6 days after
  const daysToAdd = lastDayOfWeek === 0 ? 0 : 6 - lastDayOfWeek + 1;
  const end = new Date(year, month + 1, daysToAdd);
  end.setHours(23, 59, 59, 999);

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
