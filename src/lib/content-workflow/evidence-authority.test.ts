import { beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../../contracts/fixtures/evidence-brief-v2-valid.json';
import { verifyWorkflowEvidence } from './evidence-authority';

const params = { operationId: 'operation', workspaceId: 'workspace', projectId: 'p1', approvalId: fixture.approval.id };
describe('durable evidence authority', () => {
  beforeEach(() => { vi.stubEnv('CONTENT_EVIDENCE_BRIEF_ENABLED', 'true'); vi.stubEnv('CONTENT_USAGE_CALLBACK_SECRET', 'fake-service-secret'); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { brief: fixture } })))); });
  it('fetches live evidence with service credentials and bound IDs, without stored user tokens', async () => {
    expect(await verifyWorkflowEvidence({ ...params, snapshot: fixture as never })).toEqual(fixture);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/internal/content-evidence/verify'), expect.objectContaining({ body: JSON.stringify(params), headers: { Authorization: 'Bearer fake-service-secret', 'Content-Type': 'application/json' }, cache: 'no-store' }));
  });
  it('rejects changed facts even if the approval ID is unchanged', async () => {
    await expect(verifyWorkflowEvidence({ ...params, snapshot: { ...fixture, title: '其他草稿主题' } as never })).rejects.toMatchObject({ code: 'EVIDENCE_SNAPSHOT_CHANGED', retryable: false });
  });
  it('distinguishes revoked authorization from temporary service failures', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 409 }));
    await expect(verifyWorkflowEvidence(params)).rejects.toMatchObject({ retryable: false });
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 503 }));
    await expect(verifyWorkflowEvidence(params)).rejects.toMatchObject({ retryable: true });
  });
  it('fails closed for absent configuration and cross-project payloads', async () => {
    vi.stubEnv('CONTENT_USAGE_CALLBACK_SECRET', ''); await expect(verifyWorkflowEvidence(params)).rejects.toMatchObject({ code: 'EVIDENCE_CALLBACK_UNCONFIGURED' });
    expect(fetch).not.toHaveBeenCalled();
    vi.stubEnv('CONTENT_USAGE_CALLBACK_SECRET', 'fake-service-secret');
    await expect(verifyWorkflowEvidence({ ...params, projectId: 'other-project' })).rejects.toMatchObject({ code: 'EVIDENCE_AUTHORITY_INVALID' });
  });
});
