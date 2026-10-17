import { beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../../contracts/fixtures/evidence-brief-v2-valid.json';
vi.mock('@/lib/db', () => ({ prisma: { manualEvidenceTask: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() }, manualEvidenceTaskEvent: { findUnique: vi.fn(), create: vi.fn() }, $transaction: vi.fn() } }));
import { prisma } from '@/lib/db';
import { requestHash } from '@/lib/contracts/hash';
import { createManualTask, changeManualTask, manualView } from './manual-evidence';

const ctx = { workspaceId: 'ws', projectId: 'p1', userId: 'user', role: 'editor' };
const manualBrief = { ...fixture, execution: { channel: 'website', mode: 'manual_task' } };
const row = () => ({ id: 'a'.repeat(32), workspaceId: 'ws', projectId: 'p1', approvalId: fixture.approval.id, createdByUserId: 'user', ownerUserId: null,
  status: 'pending', version: 1, briefSnapshot: JSON.stringify(manualBrief), snapshotHash: requestHash(manualBrief), deliveryUrl: null, completionNotes: null });
const change = { taskId: 'a'.repeat(32), action: 'start' as const, expectedVersion: 1, idempotencyKey: 'start-key-123', reason: '核对当前材料后领取' };

describe('durable manual evidence tasks', () => {
  beforeEach(() => {
    vi.resetAllMocks(); vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify(manualBrief))));
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => (fn as (tx: typeof prisma) => unknown)(prisma) as never);
    vi.mocked(prisma.manualEvidenceTask.findFirst).mockResolvedValue(row() as never);
  });
  it('creates a frozen manual task and an audit event atomically without generation or quota rows', async () => {
    vi.mocked(prisma.manualEvidenceTask.create).mockResolvedValue(row() as never);
    const result = await createManualTask(ctx, fixture.approval.id, 'Bearer fake-visibility');
    expect(result.view.channel).toBe('website'); expect(result.view.publicationAllowed).toBe(false);
    const data = vi.mocked(prisma.manualEvidenceTask.create).mock.calls[0][0].data;
    expect(JSON.parse(data.briefSnapshot)).toEqual(manualBrief); expect(JSON.stringify(data)).not.toContain('Bearer');
    expect(prisma.$transaction).toHaveBeenCalledOnce(); expect(prisma.manualEvidenceTaskEvent.create).toHaveBeenCalledOnce();
  });
  it('replays creation without requesting an expired authority and converges a uniqueness race', async () => {
    vi.mocked(prisma.manualEvidenceTask.findUnique).mockResolvedValueOnce(row() as never);
    expect((await createManualTask(ctx, fixture.approval.id, null)).replayed).toBe(true); expect(fetch).not.toHaveBeenCalled();
    vi.mocked(prisma.manualEvidenceTask.findUnique).mockResolvedValueOnce(null).mockResolvedValueOnce(row() as never);
    vi.mocked(prisma.$transaction).mockRejectedValue({ code: 'P2002' });
    expect((await createManualTask(ctx, fixture.approval.id, 'Bearer fake-visibility')).replayed).toBe(true);
  });
  it('rejects generation-channel materials and a different project', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(fixture)));
    await expect(createManualTask(ctx, fixture.approval.id, 'Bearer fake')).rejects.toMatchObject({ code: 'MANUAL_CHANNEL_REQUIRED' });
    await expect(createManualTask({ ...ctx, projectId: 'p2' }, fixture.approval.id, 'Bearer fake')).rejects.toMatchObject({ code: 'EVIDENCE_AUTHORITY_INVALID' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('validates current material and atomically assigns the authenticated actor', async () => {
    vi.mocked(prisma.manualEvidenceTask.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.manualEvidenceTask.findFirst).mockResolvedValueOnce(row() as never).mockResolvedValueOnce({ ...row(), ownerUserId: 'user', status: 'in_progress', version: 2 } as never);
    expect((await changeManualTask(ctx, change, 'Bearer fake')).view.status).toBe('in_progress');
    expect(prisma.manualEvidenceTask.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ version: 1, workspaceId: 'ws', projectId: 'p1', status: 'pending' }), data: expect.objectContaining({ ownerUserId: 'user', version: { increment: 1 } }) }));
    expect(prisma.manualEvidenceTaskEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorId: 'user', action: 'start', version: 2 }) }));
  });
  it('blocks stale or changed evidence before advancing a task', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 409 }));
    await expect(changeManualTask(ctx, change, 'Bearer fake')).rejects.toMatchObject({ code: 'EVIDENCE_AUTHORIZATION_STALE' });
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ ...manualBrief, title: '其他材料主题' })));
    await expect(changeManualTask(ctx, change, 'Bearer fake')).rejects.toMatchObject({ code: 'EVIDENCE_SNAPSHOT_CHANGED' });
    expect(prisma.manualEvidenceTask.updateMany).not.toHaveBeenCalled();
  });
  it('rejects wrong version, wrong owner and a lost conditional update', async () => {
    await expect(changeManualTask(ctx, { ...change, expectedVersion: 4 }, 'Bearer fake')).rejects.toMatchObject({ code: 'MANUAL_VERSION_CONFLICT' });
    vi.mocked(prisma.manualEvidenceTask.findFirst).mockResolvedValue({ ...row(), ownerUserId: 'other', status: 'in_progress' } as never);
    await expect(changeManualTask(ctx, { ...change, action: 'complete' }, 'Bearer fake')).rejects.toMatchObject({ status: 403 });
    vi.mocked(prisma.manualEvidenceTask.findFirst).mockResolvedValue(row() as never);
    vi.mocked(prisma.manualEvidenceTask.updateMany).mockResolvedValue({ count: 0 });
    await expect(changeManualTask(ctx, change, 'Bearer fake')).rejects.toMatchObject({ code: 'MANUAL_VERSION_CONFLICT' });
    expect(prisma.manualEvidenceTaskEvent.create).not.toHaveBeenCalled();
  });
  it('can cancel expired materials without authority and never reopens a completed task', async () => {
    vi.mocked(prisma.manualEvidenceTask.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.manualEvidenceTask.findFirst).mockResolvedValueOnce(row() as never).mockResolvedValueOnce({ ...row(), status: 'cancelled', version: 2 } as never);
    expect((await changeManualTask(ctx, { ...change, action: 'cancel' }, null)).view.status).toBe('cancelled'); expect(fetch).not.toHaveBeenCalled();
    vi.mocked(prisma.manualEvidenceTask.findFirst).mockResolvedValue({ ...row(), status: 'completed' } as never);
    await expect(changeManualTask(ctx, change, null)).rejects.toMatchObject({ code: 'MANUAL_STATE_CONFLICT' });
  });
  it('replays the original operation receipt even after the task version changes', async () => {
    vi.mocked(prisma.manualEvidenceTask.findFirst).mockResolvedValue({ ...row(), status: 'completed', version: 3 } as never);
    vi.mocked(prisma.manualEvidenceTaskEvent.findUnique).mockResolvedValue({ requestHash: requestHash(change), responseSnapshot: JSON.stringify({ status: 'in_progress', version: 2 }) } as never);
    expect((await changeManualTask(ctx, change, null)).view.version).toBe(2); expect(fetch).not.toHaveBeenCalled();
    await expect(changeManualTask(ctx, { ...change, reason: '更换操作内容与依据' }, null)).rejects.toMatchObject({ code: 'MANUAL_KEY_CONFLICT' });
  });
  it('detects frozen snapshot tampering without claiming live authorization on reads', () => {
    expect(manualView(row() as never).materialState).toBe('not_verified');
    expect(() => manualView({ ...row(), snapshotHash: 'wrong' } as never)).toThrow('任务材料完整性检查失败');
  });
  it('records a delivery as completed human work with a bound owner and an immutable event', async () => {
    const active = { ...row(), status: 'in_progress', version: 2, ownerUserId: 'user' };
    const completed = { ...active, status: 'completed', version: 3, deliveryUrl: 'https://example.com/draft', completionNotes: '对照原文后交付内容草稿' };
    vi.mocked(prisma.manualEvidenceTask.findFirst).mockResolvedValueOnce(active as never).mockResolvedValueOnce(completed as never);
    vi.mocked(prisma.manualEvidenceTask.updateMany).mockResolvedValue({ count: 1 });
    const result = await changeManualTask(ctx, { ...change, action: 'complete', expectedVersion: 2, reason: completed.completionNotes, deliveryUrl: completed.deliveryUrl }, 'Bearer fake');
    expect(result.view.status).toBe('completed'); expect(result.view.publicationAllowed).toBe(false); expect(result.view.deliveryUrl).toBe(completed.deliveryUrl);
    expect(prisma.manualEvidenceTaskEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'complete', version: 3, actorId: 'user' }) }));
  });
});
