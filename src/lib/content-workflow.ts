import type { ContentStatus } from "@/types";

const NEXT_STATUS_ACTIONS: Record<ContentStatus, readonly ContentStatus[]> = {
  draft: ["editing"],
  genie_draft: ["editing"],
  editing: ["review"],
  review: ["approved", "revision_requested"],
  revision_requested: ["editing", "review"],
  approved: ["scheduled", "editing"],
  scheduled: ["approved", "editing"],
  publishing: ["published", "failed"],
  failed: ["approved", "scheduled"],
  published: [],
};

export function getNextStatusActions(status: ContentStatus): readonly ContentStatus[] {
  return NEXT_STATUS_ACTIONS[status];
}
