import { beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../../contracts/fixtures/evidence-brief-v3-valid.json';
import { prisma } from '@/lib/db';
vi.mock('./evidence-authority', () => ({ verifyWorkflowEvidence: vi.fn() }));
import { verifyWorkflowEvidence } from './evidence-authority';
import { createEvidenceWorkflow } from './evidence-service';
import { requestHash } from '@/lib/contracts/hash';

const ctx = { workspaceId: 'ws', projectId: 'p1', userId: 'user' }, input = { approvalId: fixture.approval.id, usageOperationId: 'evidence-draft:' + 'a'.repeat(64) };
const row = { id: 'wf', briefId: 'brief', briefRevision: 1, status: 'queued', contentPieceId: 'piece', usageOperationId: input.usageOperationId, idempotencyRequestHash: requestHash(input), runs: [] };
describe('evidence workflow creation', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(verifyWorkflowEvidence).mockResolvedValue(fixture as never); vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => (fn as (tx: typeof prisma) => unknown)(prisma) as never); });
  it('persists the approval, piece and queued run in one transaction without a user token', async () => {
    vi.mocked(prisma.contentBrief.create).mockResolvedValue({ id: 'brief', revision: 1 } as never);
    vi.mocked(prisma.contentPiece.create).mockResolvedValue({ id: 'piece' } as never);
    vi.mocked(prisma.contentWorkflow.create).mockResolvedValue(row as never);
    expect((await createEvidenceWorkflow(ctx, input)).replayed).toBe(false);
    const data = vi.mocked(prisma.contentWorkflow.create).mock.calls[0][0].data;
    expect(JSON.parse(data.briefSnapshot as string)).toEqual(fixture);
    expect(data.runs).toEqual({ create: [{ platform: 'wechat', status: 'queued' }] });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(data)).not.toContain('Bearer');
  });
  it('replays an accepted task before revalidating an expired authorization', async () => {
    vi.mocked(prisma.contentWorkflow.findFirst).mockResolvedValue(row as never);
    expect((await createEvidenceWorkflow(ctx, input)).replayed).toBe(true);
    expect(verifyWorkflowEvidence).not.toHaveBeenCalled(); expect(prisma.$transaction).not.toHaveBeenCalled();
    await expect(createEvidenceWorkflow(ctx, { ...input, usageOperationId: 'other-operation' })).rejects.toMatchObject({ status: 409 });
  });
  it('does not enqueue a manual channel or stale authorization', async () => {
    vi.mocked(verifyWorkflowEvidence).mockResolvedValue({ ...fixture, execution: { channel: 'website', mode: 'manual_task' } } as never);
    await expect(createEvidenceWorkflow(ctx, input)).rejects.toMatchObject({ code: 'MANUAL_CHANNEL' });
    vi.mocked(verifyWorkflowEvidence).mockRejectedValue(new Error('stale'));
    await expect(createEvidenceWorkflow(ctx, input)).rejects.toThrow('stale');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('converges a concurrent unique-key race on the same task', async () => {
    vi.mocked(prisma.contentWorkflow.findFirst).mockResolvedValueOnce(null).mockResolvedValueOnce(row as never);
    vi.mocked(prisma.$transaction).mockRejectedValue({ code: 'P2002' });
    expect((await createEvidenceWorkflow(ctx, input)).replayed).toBe(true);
  });
});
