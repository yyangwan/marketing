import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/auth/service-auth', () => ({ getServiceSession: vi.fn() }));
vi.mock('@/lib/auth/service-context', () => ({ getServiceWorkspace: vi.fn() }));
vi.mock('@/lib/content-workflow/evidence-service', () => ({ createEvidenceWorkflow: vi.fn() }));
import { getServiceSession } from '@/lib/auth/service-auth';
import { getServiceWorkspace } from '@/lib/auth/service-context';
import { createEvidenceWorkflow } from '@/lib/content-workflow/evidence-service';
import { POST } from './route';

const body = { approvalId: 'a'.repeat(32), usageOperationId: 'evidence-draft:' + 'b'.repeat(64) };
const req = (value: unknown = body) => new Request('http://localhost/api/evidence-briefs/workflows', { method: 'POST', body: JSON.stringify(value) });
describe('evidence workflow API', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('CONTENT_EVIDENCE_BRIEF_ENABLED', 'true'); vi.stubEnv('CONTENT_WORKFLOW_DISABLED', 'false'); vi.mocked(getServiceSession).mockResolvedValue({ user: { id: 'user' } } as never); vi.mocked(getServiceWorkspace).mockResolvedValue({ userId: 'user', workspaceId: 'ws', projectId: 'p1', role: 'editor', scope: 'project' }); vi.mocked(createEvidenceWorkflow).mockResolvedValue({ replayed: false, view: { id: 'wf' } } as never); });
  it('creates only in the verified project and returns a durable task', async () => {
    expect((await POST(req())).status).toBe(202);
    expect(createEvidenceWorkflow).toHaveBeenCalledWith({ workspaceId: 'ws', projectId: 'p1', userId: 'user' }, body);
    vi.mocked(createEvidenceWorkflow).mockResolvedValue({ replayed: true, view: { id: 'wf' } } as never);
    expect((await POST(req())).status).toBe(200);
  });
  it('rejects caller facts, viewer identity and mismatched sessions', async () => {
    expect((await POST(req({ ...body, brief: { fake: true } }))).status).toBe(422);
    vi.mocked(getServiceWorkspace).mockResolvedValue({ userId: 'user', workspaceId: 'ws', projectId: 'p1', role: 'viewer', scope: 'project' }); expect((await POST(req())).status).toBe(403);
    vi.mocked(getServiceSession).mockResolvedValue({ user: { id: 'other' } } as never); expect((await POST(req())).status).toBe(403);
    expect(createEvidenceWorkflow).not.toHaveBeenCalled();
  });
  it('does not create when the feature is disabled', async () => {
    vi.stubEnv('CONTENT_EVIDENCE_BRIEF_ENABLED', 'false'); expect((await POST(req())).status).toBe(503); expect(createEvidenceWorkflow).not.toHaveBeenCalled();
  });
});
