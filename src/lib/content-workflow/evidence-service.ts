import { prisma } from '@/lib/db';
import { requestHash, isUniqueConstraintError } from '@/lib/contracts/hash';
import { evidenceToGenerationInput } from '@/lib/content-brief/evidence-v2';
import { verifyWorkflowEvidence } from './evidence-authority';
import { WorkflowValidationError, toWorkflowView } from './service';

export async function createEvidenceWorkflow(ctx: { workspaceId: string; projectId: string; userId: string }, input: { approvalId: string; usageOperationId: string }) {
  // One authorization means one workflow even when a client changes its retry key.
  const key = `evidence-${input.approvalId}`, hash = requestHash(input);
  const lookup = () => prisma.contentWorkflow.findFirst({ where: { workspaceId: ctx.workspaceId, projectId: ctx.projectId, idempotencyKey: key }, include: { runs: true } });
  const replay = (row: NonNullable<Awaited<ReturnType<typeof lookup>>>) => {
    if (row.idempotencyRequestHash !== hash) throw new WorkflowValidationError(409, 'EVIDENCE_OPERATION_CONFLICT', '草稿授权已绑定其他生成操作');
    return { replayed: true, view: toWorkflowView(row) };
  };
  const existing = await lookup();
  if (existing) return replay(existing);
  const brief = await verifyWorkflowEvidence({ operationId: input.usageOperationId, workspaceId: ctx.workspaceId, projectId: ctx.projectId, approvalId: input.approvalId });
  const generationInput = evidenceToGenerationInput(brief);
  if (!generationInput) throw new WorkflowValidationError(422, 'MANUAL_CHANNEL', '该渠道需要人工内容任务');
  if (Array.from(brief.title).length > 191) throw new WorkflowValidationError(422, 'TITLE_TOO_LONG', '生成任务标题最多191字，请重新审批');
  try {
    const row = await prisma.$transaction(async tx => {
      const stored = await tx.contentBrief.create({ data: {
        workspaceId: ctx.workspaceId, projectId: ctx.projectId, createdByUserId: ctx.userId, schemaVersion: 2,
        status: 'confirmed', sourceType: 'evidence_v2', sourceSuggestionId: brief.approval.id, sourceHash: requestHash(brief),
        sourceSnapshot: JSON.stringify(brief), projectSnapshot: JSON.stringify({ projectId: ctx.projectId }),
        baselineBrief: JSON.stringify(brief), effectiveBrief: JSON.stringify(brief), generationMeta: JSON.stringify({ source: 'human_approved_evidence', publicationAllowed: false }),
        idempotencyKey: key, idempotencyRequestHash: hash, refinementStatus: 'not_required', confirmedAt: new Date(), expiresAt: new Date(brief.approval.expiresAt),
      } });
      const piece = await tx.contentPiece.create({ data: {
        workspaceId: ctx.workspaceId, projectId: ctx.projectId, createdByUserId: ctx.userId, title: brief.title, type: 'blog_post', status: 'draft',
        brief: JSON.stringify(generationInput), platformContents: { create: [{ platform: brief.execution.channel, status: 'draft' }] },
      } });
      return tx.contentWorkflow.create({ data: {
        workspaceId: ctx.workspaceId, projectId: ctx.projectId, briefId: stored.id, briefRevision: stored.revision, briefSnapshot: JSON.stringify(brief),
        contentPieceId: piece.id, usageOperationId: input.usageOperationId, usageStatus: 'reserved', idempotencyKey: key, idempotencyRequestHash: hash,
        runs: { create: [{ platform: brief.execution.channel, status: 'queued' }] },
      }, include: { runs: true } });
    });
    return { replayed: false, view: toWorkflowView(row) };
  } catch (error) {
    if (isUniqueConstraintError(error)) { const raced = await lookup(); if (raced) return replay(raced); }
    throw error;
  }
}
