import { NextResponse } from 'next/server';
import { getServiceSession } from '@/lib/auth/service-auth';
import { getServiceWorkspace } from '@/lib/auth/service-context';
import { prisma } from '@/lib/db';
import { requestHash } from '@/lib/contracts/hash';
import { checkedHistoricalBrief } from '@/lib/content-brief/evidence-v3';

// A scoped immutable-origin receipt; it never authorizes publishing or certifies content quality.
export async function GET(req: Request) {
  if (process.env.CONTENT_EVIDENCE_BRIEF_ENABLED !== 'true') return NextResponse.json({ error: '证据内容功能尚未启用。' }, { status: 503 });
  const session = await getServiceSession(), ctx = await getServiceWorkspace();
  if (!session?.user?.id || !ctx || ctx.userId !== session.user.id || ctx.scope !== 'project' || !ctx.projectId) return NextResponse.json({ error: '需要当前项目权限。' }, { status: 403 });
  const q = new URL(req.url).searchParams, kind = q.get('kind'), id = q.get('referenceId');
  if ([...q.keys()].some(key => !['kind', 'referenceId'].includes(key)) || !id || !/^[a-zA-Z0-9_-]{1,191}$/.test(id) || !['content_workflow', 'manual_content_task'].includes(kind || '')) return NextResponse.json({ error: '交付来源参数无效。' }, { status: 422 });
  const scope = { id, workspaceId: ctx.workspaceId, projectId: ctx.projectId };
  let snapshot: string, hash: string, status: string, contentId: string | null;
  if (kind === 'content_workflow') {
    const row = await prisma.contentWorkflow.findFirst({ where: scope, include: { brief: true } });
    if (!row) return NextResponse.json({ error: '草稿任务不存在。' }, { status: 404 });
    snapshot = row.briefSnapshot; hash = row.brief.sourceHash || ''; status = row.status; contentId = row.contentPieceId;
    if (status !== 'succeeded' || row.brief.sourceType !== 'evidence_v3') return NextResponse.json({ error: '需要本行动生成完成的证据草稿。' }, { status: 409 });
  } else {
    const row = await prisma.manualEvidenceTask.findFirst({ where: scope });
    if (!row) return NextResponse.json({ error: '人工内容任务不存在。' }, { status: 404 });
    snapshot = row.briefSnapshot; hash = row.snapshotHash; status = row.status; contentId = null;
    if (status !== 'completed') return NextResponse.json({ error: '人工任务尚未交付完成。' }, { status: 409 });
  }
  try {
    const raw = JSON.parse(snapshot);
    // Historical grant expiry forbids new generation; it does not erase the origin of a completed artifact.
    const brief = checkedHistoricalBrief(raw, ctx.projectId, raw.approval.id);
    if (requestHash(raw) !== hash) return NextResponse.json({ error: '交付材料快照校验失败。' }, { status: 409 });
    return NextResponse.json({ data: { kind, reference_id: id, project_id: ctx.projectId, action_id: brief.actionId,
      revision_id: brief.actionRevision.id, approval_id: brief.approval.id, snapshot_hash: hash, status, content_id: contentId,
      authorization_state: 'historical_origin_only', publication_allowed: false, content_quality_verified: false } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: '交付材料合同校验失败。' }, { status: 409 }); }
}
