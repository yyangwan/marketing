/**
 * content-brief 内部视图类型：契约 V1 的可空变体与持久化行形状。
 */

import type {
  ContentCreationBriefV1,
  ProjectSnapshotV1,
  VisibilitySuggestionSnapshotV1,
} from "@/contracts/content-creation-brief-v1";

export type { ContentCreationBriefV1, ProjectSnapshotV1, VisibilitySuggestionSnapshotV1 };

export type GenerationMetaView = ContentCreationBriefV1["generationMeta"];

/** ContentBrief 数据库行的领域视图（JSON 字段尚未解析）。 */
export interface ContentBriefRow {
  id: string;
  workspaceId: string;
  projectId: string;
  createdByUserId: string;
  schemaVersion: number;
  revision: number;
  status: string;
  sourceType: string;
  sourceSuggestionId: string;
  sourceHash: string;
  sourceSnapshot: string;
  projectSnapshot: string;
  baselineBrief: string;
  refinedCandidate: string | null;
  effectiveBrief: string;
  generationMeta: string;
  idempotencyKey: string;
  idempotencyRequestHash: string;
  refinementStatus: string;
  refinementAttempts: number;
  refinementNextAttemptAt: Date | null;
  refinementLockedBy: string | null;
  refinementLockedUntil: Date | null;
  refinementLastError: string | null;
  confirmedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
