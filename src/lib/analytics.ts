/**
 * ContentOS Analytics Configuration
 *
 * Privacy-first analytics for DX measurement.
 * All events are anonymous unless user opts in to enhanced tracking.
 *
 * Measurement goals:
 * - Time to Hello World (TTHW)
 * - Journey drop-off points
 * - Feature adoption rates
 * - Error frequencies
 */

type EventName =
  // Getting Started
  | "app.visited"
  | "app.setup_started"
  | "app.setup_completed"
  | "app.first_brief_created"
  // Features
  | "brief.created"
  | "brief.generated"
  | "content.edited"
  | "content.status_changed"
  | "project.created"
  | "workspace.created"
  // Performance
  | "app.timing"
  // Errors
  | "error.api"
  | "error.validation"
  | "error.ai"
  // Feedback
  | "feedback.submitted"
  | "documentation.viewed";

interface AnalyticsEvent {
  name: EventName;
  properties?: Record<string, string | number | boolean>;
  timestamp: number;
}

/**
 * Check if analytics is enabled
 */
export function isAnalyticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("analytics_consent") === "true";
}

/**
 * Check if enhanced tracking is enabled (includes session data)
 */
export function isEnhancedTracking(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("analytics_enhanced") === "true";
}

/**
 * Track an event
 */
export function track(name: EventName, properties?: Record<string, string | number | boolean>): void {
  if (!isAnalyticsEnabled()) return;

  const event: AnalyticsEvent = {
    name,
    properties: {
      ...properties,
      enhanced: isEnhancedTracking(),
      url: typeof window !== "undefined" ? window.location.pathname : "/",
    },
    timestamp: Date.now(),
  };

  // In production, send to analytics service
  if (process.env.NODE_ENV === "production") {
    // TODO: Integrate with Plausible/PostHog
    // plausible("trackEvent", { name, props: properties });
    console.debug("[Analytics]", event);
  } else {
    console.debug("[Analytics]", event);
  }
}

/**
 * Track time to complete an operation (for TTHW measurement)
 */
export function trackTiming(operation: string, durationMs: number): void {
  track("app.timing", {
    operation,
    duration_ms: durationMs,
  });
}

/**
 * Track error with context
 */
export function trackError(
  type: "api" | "validation" | "ai",
  code: string,
  message: string,
  context?: Record<string, string | number | boolean>
): void {
  track(`error.${type}` as EventName, {
    code,
    message,
    ...context,
  });
}

/**
 * Start a timer for TTHW measurement
 */
export class TTHTimer {
  private start: number;
  private readonly eventName: EventName;

  constructor(eventName: EventName) {
    this.start = Date.now();
    this.eventName = eventName;
  }

  end(properties?: Record<string, string | number | boolean>): void {
    const duration = Date.now() - this.start;
    trackTiming(this.eventName.toString().replace(".", "_"), duration);

    // Also track the completion event with timing
    track(this.eventName, {
      ...properties,
      duration_ms: duration,
    });
  }
}

/**
 * Helper to measure TTHW from first visit to first Brief creation
 */
export function measureTTHW(): TTHTimer {
  return new TTHTimer("app.first_brief_created");
}

/**
 * Analytics consent management
 */
export const analyticsConsent = {
  grant: () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("analytics_consent", "true");
    }
  },

  revoke: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("analytics_consent");
      localStorage.removeItem("analytics_enhanced");
    }
  },

  enableEnhanced: () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("analytics_enhanced", "true");
    }
  },

  disableEnhanced: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("analytics_enhanced");
    }
  },

  getStatus: () => ({
    enabled: isAnalyticsEnabled(),
    enhanced: isEnhancedTracking(),
  }),
};

/**
 * Hook for React components to use analytics
 */
export function useAnalytics() {
  return {
    track,
    trackError,
    measureTTHW,
    consent: analyticsConsent,
  };
}

/**
 * Initialize analytics (call once on app load)
 */
export function initAnalytics(): void {
  if (typeof window === "undefined") return;

  // Track first visit
  const hasVisited = localStorage.getItem("has_visited");
  if (!hasVisited) {
    track("app.visited");
    localStorage.setItem("has_visited", "true");
  }

  // Track returning user
  if (hasVisited) {
    track("app.visited", { returning: true });
  }
}
