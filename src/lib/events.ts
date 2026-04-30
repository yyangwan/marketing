/**
 * Custom event names used for cross-component communication
 */

export const CUSTOM_EVENTS = {
  /**
   * Dispatched when content is scheduled or unscheduled via calendar
   * Triggers immediate refresh of the unscheduled panel
   */
  UNSCHEDULED_REFRESH: 'unscheduled-refresh',
} as const;
