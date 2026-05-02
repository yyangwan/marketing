import type { ContentStatus } from "@/types";

const CONTENT_STATUS_VALUES = [
  "draft",
  "genie_draft",
  "editing",
  "review",
  "revision_requested",
  "approved",
  "scheduled",
  "publishing",
  "failed",
  "published",
] as const satisfies readonly ContentStatus[];

const CONTENT_STATUS_SET = new Set<string>(CONTENT_STATUS_VALUES);

const CONTENT_STATUS_ALIASES = {
  in_review: "review",
} as const;

export function isContentStatus(value: unknown): value is ContentStatus {
  return typeof value === "string" && CONTENT_STATUS_SET.has(value);
}

export function normalizeContentStatus(value: unknown): ContentStatus | null {
  if (typeof value !== "string") {
    return null;
  }

  const alias = CONTENT_STATUS_ALIASES[value as keyof typeof CONTENT_STATUS_ALIASES];
  if (alias) {
    return alias;
  }

  return isContentStatus(value) ? value : null;
}
