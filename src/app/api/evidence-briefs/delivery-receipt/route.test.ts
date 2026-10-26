import { beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../../../../contracts/fixtures/evidence-brief-v3-valid.json';
vi.mock('@/lib/auth/service-auth',()=>({getServiceSession:vi.fn()}));
vi.mock('@/lib/auth/service-context',()=>({getServiceWorkspace:vi.fn()}));
vi.mock('@/lib/db',()=>({prisma:{contentWorkflow:{findFirst:vi.fn()},manualEvidenceTask:{findFirst:vi.fn()}}}));
import { getServiceSession } from '@/lib/auth/service-auth';
import { getServiceWorkspace } from '@/lib/auth/service-context';
import { prisma } from '@/lib/db';
import { requestHash } from '@/lib/contracts/hash';
import { GET } from './route';
const req=(kind='content_workflow',id='workflow')=>new Request(`http://localhost/api/evidence-briefs/delivery-receipt?kind=${kind}&referenceId=${id}`);
const row=()=>({briefSnapshot:JSON.stringify(fixture),status:'succeeded',contentPieceId:'content',brief:{sourceHash:requestHash(fixture),sourceType:'evidence_v3'}});
describe('project-scoped completed artifact origin receipt',()=>{
  beforeEach(()=>{
    vi.resetAllMocks();vi.stubEnv('CONTENT_EVIDENCE_BRIEF_ENABLED','true');
    vi.mocked(getServiceSession).mockResolvedValue({user:{id:'user'}} as never);
    vi.mocked(getServiceWorkspace).mockResolvedValue({workspaceId:'ws',projectId:'p1',userId:'user',scope:'project',role:'editor'} as never);
    vi.mocked(prisma.contentWorkflow.findFirst).mockResolvedValue(row() as never);
  });
  it('derives exact revision and approval from the frozen v3 brief with scoped lookup',async()=>{
    const response=await GET(req()),value=(await response.json()).data;
    expect(response.status).toBe(200);
    expect(value).toMatchObject({project_id:'p1',action_id:fixture.actionId,revision_id:fixture.actionRevision.id,approval_id:fixture.approval.id,snapshot_hash:requestHash(fixture),authorization_state:'historical_origin_only',publication_allowed:false,content_quality_verified:false});
    expect(prisma.contentWorkflow.findFirst).toHaveBeenCalledWith({where:{id:'workflow',workspaceId:'ws',projectId:'p1'},include:{brief:true}});
  });
  it('does not erase the provenance of a completed artifact after authorization expiry',async()=>{
    const historical=structuredClone(fixture);historical.approval.expiresAt='2025-06-01T00:00:00Z';
    historical.ownFacts[0].validFrom='2024-01-01T00:00:00Z';historical.ownFacts[0].validUntil='2026-01-01T00:00:00Z';
    vi.mocked(prisma.contentWorkflow.findFirst).mockResolvedValue({...row(),briefSnapshot:JSON.stringify(historical),brief:{sourceHash:requestHash(historical),sourceType:'evidence_v3'}} as never);
    expect((await GET(req())).status).toBe(200);
  });
  it('rejects queued work, ordinary non-evidence workflows and changed snapshots',async()=>{
    vi.mocked(prisma.contentWorkflow.findFirst).mockResolvedValueOnce({...row(),status:'queued'} as never);
    expect((await GET(req())).status).toBe(409);
    vi.mocked(prisma.contentWorkflow.findFirst).mockResolvedValueOnce({...row(),brief:{sourceHash:requestHash(fixture),sourceType:'manual'}} as never);
    expect((await GET(req())).status).toBe(409);
    vi.mocked(prisma.contentWorkflow.findFirst).mockResolvedValueOnce({...row(),brief:{sourceHash:'0'.repeat(64),sourceType:'evidence_v3'}} as never);
    expect((await GET(req())).status).toBe(409);
  });
  it('requires completed manual tasks and retains their own original revision',async()=>{
    const manual={...fixture,execution:{channel:'website',mode:'manual_task'}};
    vi.mocked(prisma.manualEvidenceTask.findFirst).mockResolvedValue({briefSnapshot:JSON.stringify(manual),snapshotHash:requestHash(manual),status:'completed'} as never);
    expect((await GET(req('manual_content_task','a'.repeat(32)))).status).toBe(200);
    vi.mocked(prisma.manualEvidenceTask.findFirst).mockResolvedValue({status:'in_progress'} as never);
    expect((await GET(req('manual_content_task','a'.repeat(32)))).status).toBe(409);
  });
  it('fails closed for missing scope, missing rows and disabled feature',async()=>{
    vi.mocked(prisma.contentWorkflow.findFirst).mockResolvedValueOnce(null);
    expect((await GET(req())).status).toBe(404);
    vi.mocked(getServiceWorkspace).mockResolvedValueOnce(null);
    expect((await GET(req())).status).toBe(403);
    vi.stubEnv('CONTENT_EVIDENCE_BRIEF_ENABLED','false');expect((await GET(req())).status).toBe(503);
  });
});
