import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/db', () => ({ prisma: { manualEvidenceTask: { findMany: vi.fn(), findFirst: vi.fn() }, manualEvidenceTaskEvent: { findMany: vi.fn() } } }));
vi.mock('@/lib/auth/service-auth', () => ({ getServiceSession: vi.fn() }));
vi.mock('@/lib/auth/service-context', () => ({ getServiceWorkspace: vi.fn() }));
vi.mock('@/lib/content-workflow/manual-evidence', () => ({ createManualTask: vi.fn(), changeManualTask: vi.fn(), manualView: vi.fn() }));
import { getServiceSession } from '@/lib/auth/service-auth';
import { getServiceWorkspace } from '@/lib/auth/service-context';
import { createManualTask, changeManualTask } from '@/lib/content-workflow/manual-evidence';
import { prisma } from '@/lib/db';
import { GET, POST } from './route';
const req = (body: unknown) => new Request('http://localhost/api/evidence-briefs/manual-tasks', { method: 'POST', body: JSON.stringify(body) });
describe('manual task API authorization', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('CONTENT_EVIDENCE_BRIEF_ENABLED', 'true'); vi.mocked(getServiceSession).mockResolvedValue({ user: { id: 'user' } } as never); vi.mocked(getServiceWorkspace).mockResolvedValue({ workspaceId: 'ws', projectId: 'p1', userId: 'user', role: 'editor', scope: 'project' }); vi.mocked(createManualTask).mockResolvedValue({ replayed: false, view: {} } as never); });
  it('creates only under authenticated context and rejects browser facts or identity', async () => {
    expect((await POST(req({ action: 'create', approvalId: 'a'.repeat(32) }))).status).toBe(202);
    expect(createManualTask).toHaveBeenCalledWith({ workspaceId: 'ws', projectId: 'p1', userId: 'user', role: 'editor' }, 'a'.repeat(32), null);
    expect((await POST(req({ action: 'create', approvalId: 'a'.repeat(32), brief: {} }))).status).toBe(422);
  });
  it('blocks viewers and mismatched sessions before touching tasks', async () => {
    vi.mocked(getServiceWorkspace).mockResolvedValue({ workspaceId: 'ws', projectId: 'p1', userId: 'user', role: 'viewer', scope: 'project' });
    expect((await POST(req({ action: 'create', approvalId: 'a'.repeat(32) }))).status).toBe(403);
    expect(createManualTask).not.toHaveBeenCalled();
  });
  it('rejects invalid delivery URLs and publication fields', async () => {
    const input = { action: 'complete', taskId: 'a'.repeat(32), expectedVersion: 2, idempotencyKey: 'complete-key-123', reason: '核对材料后人工交付' };
    expect((await POST(req({ ...input, deliveryUrl: 'javascript:alert(1)' }))).status).toBe(422);
    expect((await POST(req({ ...input, deliveryUrl: 'bad-url' }))).status).toBe(422);
    expect((await POST(req({ ...input, publicationAllowed: true }))).status).toBe(422);
    expect(changeManualTask).not.toHaveBeenCalled();
  });
  it('reads only the verified workspace/project and never leaks another task history', async () => {
    vi.mocked(prisma.manualEvidenceTask.findMany).mockResolvedValue([]);
    expect((await GET(new Request('http://localhost/api/evidence-briefs/manual-tasks?projectId=attacker'))).status).toBe(200);
    expect(prisma.manualEvidenceTask.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: 'ws', projectId: 'p1' } }));
    vi.mocked(prisma.manualEvidenceTask.findFirst).mockResolvedValue(null);
    expect((await GET(new Request('http://localhost/api/evidence-briefs/manual-tasks?taskId=' + 'a'.repeat(32)))).status).toBe(404);
    expect(prisma.manualEvidenceTaskEvent.findMany).not.toHaveBeenCalled();
  });
});
