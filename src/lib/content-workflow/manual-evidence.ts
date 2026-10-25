import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { requestHash, isUniqueConstraintError } from '@/lib/contracts/hash';
import { checkedEvidenceBrief, type EvidenceBriefV3 } from '@/lib/content-brief/evidence-v3';
import { EvidenceAuthorityError } from './evidence-authority';
import { WorkflowValidationError } from './service';
import type { ManualEvidenceTask } from '@/generated/prisma/client';

export type ManualContext = { workspaceId: string; projectId: string; userId: string; role: string };
export type ManualChange = { taskId: string; action: 'start' | 'complete' | 'cancel'; expectedVersion: number; idempotencyKey: string; reason: string; deliveryUrl?: string };

export async function readManualAuthority(ctx: ManualContext, approvalId: string, token: string | null): Promise<EvidenceBriefV3> {
  if (!token?.startsWith('Bearer ') || token.length > 8192) throw new WorkflowValidationError(403, 'AUTHORITY_REQUIRED', '需要当前项目的证据权限');
  let response: Response, raw: unknown;
  try {
    response = await fetch(`${process.env.VISIBILITY_SERVICE_URL || 'http://127.0.0.1:8000'}/api/intelligence/draft-approvals/${approvalId}/brief`, {
      headers: { Authorization: token }, cache: 'no-store', signal: AbortSignal.timeout(8000),
    }); raw = await response.json();
  } catch { throw new EvidenceAuthorityError('EVIDENCE_AUTHORITY_UNAVAILABLE', true); }
  if (!response.ok) throw new EvidenceAuthorityError(response.status >= 500 ? 'EVIDENCE_AUTHORITY_UNAVAILABLE' : 'EVIDENCE_AUTHORIZATION_STALE', response.status >= 500);
  let brief: EvidenceBriefV3;
  try { brief = checkedEvidenceBrief(raw, ctx.projectId, approvalId); }
  catch { throw new EvidenceAuthorityError('EVIDENCE_AUTHORITY_INVALID', false); }
  if (brief.execution.mode !== 'manual_task') throw new WorkflowValidationError(422, 'MANUAL_CHANNEL_REQUIRED', '该授权应进入草稿生成任务');
  return brief;
}

export function manualView(row: ManualEvidenceTask) {
  // Keep historical material readable when expired; no live authorization claim is made by a GET.
  const brief = JSON.parse(row.briefSnapshot) as EvidenceBriefV3;
  if (requestHash(brief) !== row.snapshotHash) throw new WorkflowValidationError(409, 'MANUAL_SNAPSHOT_CHANGED', '任务材料完整性检查失败');
  return { id: row.id, approvalId: row.approvalId, status: row.status, version: row.version, ownerUserId: row.ownerUserId,
    title: brief.title, channel: brief.execution.channel, aiTargets: brief.aiTargets, facts: brief.ownFacts,
    actionRevision: brief.actionRevision, taskPack: brief.taskPack,
    expiresAt: brief.approval.expiresAt, materialState: Date.parse(brief.approval.expiresAt) <= Date.now() ? 'expired' : 'not_verified',
    deliveryUrl: row.deliveryUrl, completionNotes: row.completionNotes, publicationAllowed: false as const };
}

export async function createManualTask(ctx: ManualContext, approvalId: string, token: string | null) {
  const lookup = () => prisma.manualEvidenceTask.findUnique({ where: { workspaceId_projectId_approvalId: { workspaceId: ctx.workspaceId, projectId: ctx.projectId, approvalId } } });
  const existing = await lookup();
  if (existing) return { replayed: true, view: manualView(existing) };
  const brief = await readManualAuthority(ctx, approvalId, token);
  const id = randomUUID().replaceAll('-', '');
  const data = { id, workspaceId: ctx.workspaceId, projectId: ctx.projectId, approvalId, createdByUserId: ctx.userId,
    briefSnapshot: JSON.stringify(brief), snapshotHash: requestHash(brief) };
  try {
    const row = await prisma.$transaction(async tx => {
      const created = await tx.manualEvidenceTask.create({ data });
      await tx.manualEvidenceTaskEvent.create({ data: { taskId: created.id, version: 1, action: 'created', actorId: ctx.userId,
        reason: '从当前获批材料创建人工任务', idempotencyKey: 'creation', requestHash: requestHash({ approvalId }), responseSnapshot: JSON.stringify(manualView(created)) } });
      return created;
    });
    return { replayed: false, view: manualView(row) };
  } catch (error) {
    if (isUniqueConstraintError(error)) { const raced = await lookup(); if (raced) return { replayed: true, view: manualView(raced) }; }
    throw error;
  }
}

export async function changeManualTask(ctx: ManualContext, input: ManualChange, token: string | null) {
  const where = { id: input.taskId, workspaceId: ctx.workspaceId, projectId: ctx.projectId };
  const row = await prisma.manualEvidenceTask.findFirst({ where });
  if (!row) throw new WorkflowValidationError(404, 'MANUAL_TASK_NOT_FOUND', '人工任务不存在');
  const hash = requestHash(input);
  const receipt = () => prisma.manualEvidenceTaskEvent.findUnique({ where: { taskId_idempotencyKey: { taskId: row.id, idempotencyKey: input.idempotencyKey } } });
  const replay = (event: NonNullable<Awaited<ReturnType<typeof receipt>>>) => {
    if (event.requestHash !== hash) throw new WorkflowValidationError(409, 'MANUAL_KEY_CONFLICT', '操作编号已用于其他请求');
    return { replayed: true, view: JSON.parse(event.responseSnapshot) as ReturnType<typeof manualView> };
  };
  const existing = await receipt(); if (existing) return replay(existing);
  if (row.version !== input.expectedVersion) throw new WorkflowValidationError(409, 'MANUAL_VERSION_CONFLICT', '任务已更新，请刷新后重试');
  const elevated = ['owner', 'admin'].includes(ctx.role);
  if (input.action === 'start' ? row.status !== 'pending' : input.action === 'complete' ? row.status !== 'in_progress' : !['pending', 'in_progress'].includes(row.status)) throw new WorkflowValidationError(409, 'MANUAL_STATE_CONFLICT', '当前状态不允许该操作');
  if (input.action === 'complete' && row.ownerUserId !== ctx.userId && !elevated || input.action === 'cancel' && row.ownerUserId !== ctx.userId && row.createdByUserId !== ctx.userId && !elevated) throw new WorkflowValidationError(403, 'MANUAL_OWNER_REQUIRED', '需要任务负责人或管理员操作');
  if (input.action !== 'cancel') {
    const live = await readManualAuthority(ctx, row.approvalId, token);
    if (requestHash(live) !== row.snapshotHash) throw new EvidenceAuthorityError('EVIDENCE_SNAPSHOT_CHANGED', false);
  }
  const status = input.action === 'start' ? 'in_progress' : input.action === 'complete' ? 'completed' : 'cancelled';
  try {
    const updated = await prisma.$transaction(async tx => {
      const changed = await tx.manualEvidenceTask.updateMany({ where: { ...where, version: input.expectedVersion, status: row.status }, data: {
        status, version: { increment: 1 }, ...(input.action === 'start' ? { ownerUserId: ctx.userId } : {}),
        ...(input.action === 'complete' ? { completionNotes: input.reason, deliveryUrl: input.deliveryUrl || null } : {}),
      } });
      if (changed.count !== 1) throw new WorkflowValidationError(409, 'MANUAL_VERSION_CONFLICT', '任务已更新，请刷新后重试');
      const fresh = await tx.manualEvidenceTask.findFirst({ where });
      if (!fresh) throw new Error('manual_task_missing_after_update');
      await tx.manualEvidenceTaskEvent.create({ data: { taskId: row.id, version: fresh.version, action: input.action, actorId: ctx.userId,
        reason: input.reason, deliveryUrl: input.deliveryUrl || null, idempotencyKey: input.idempotencyKey, requestHash: hash, responseSnapshot: JSON.stringify(manualView(fresh)) } });
      return fresh;
    });
    return { replayed: false, view: manualView(updated) };
  } catch (error) {
    // The losing concurrent update can replay the winner after its transaction commits.
    if (isUniqueConstraintError(error) || error instanceof WorkflowValidationError && error.code === 'MANUAL_VERSION_CONFLICT') {
      const event = await receipt(); if (event) return replay(event);
    }
    throw error;
  }
}
