import { NextResponse } from 'next/server';
import { getServiceSession } from '@/lib/auth/service-auth';
import { getServiceWorkspace } from '@/lib/auth/service-context';
import { prisma } from '@/lib/db';
import { createManualTask, changeManualTask, manualView, type ManualContext, type ManualChange } from '@/lib/content-workflow/manual-evidence';
import { WorkflowValidationError } from '@/lib/content-workflow/service';
import { EvidenceAuthorityError } from '@/lib/content-workflow/evidence-authority';

async function context(write: boolean): Promise<ManualContext> {
  if (process.env.CONTENT_EVIDENCE_BRIEF_ENABLED !== 'true') throw new WorkflowValidationError(503, 'EVIDENCE_DISABLED', '证据内容功能尚未启用');
  const session = await getServiceSession(), ctx = await getServiceWorkspace();
  if (!session?.user?.id || !ctx || ctx.userId !== session.user.id || ctx.scope !== 'project' || !ctx.projectId || write && !['owner', 'admin', 'editor', 'member'].includes(ctx.role)) throw new WorkflowValidationError(403, 'PROJECT_ACCESS_REQUIRED', '需要当前项目权限');
  return { workspaceId: ctx.workspaceId, projectId: ctx.projectId, userId: session.user.id, role: ctx.role };
}

function failure(error: unknown) {
  if (error instanceof WorkflowValidationError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  if (error instanceof EvidenceAuthorityError) return NextResponse.json({ error: error.retryable ? '证据服务暂不可用，请沿用原操作编号重试' : '证据授权已失效，请重新复核并审批材料', code: error.code }, { status: error.retryable ? 503 : 409 });
  return NextResponse.json({ error: '人工任务操作结果尚待确认，请刷新或沿用原编号重试' }, { status: 503 });
}

export async function GET(req: Request) {
  try {
    const ctx = await context(false);
    const taskId = new URL(req.url).searchParams.get('taskId');
    if (taskId) {
      if (!/^[a-f0-9]{32}$/.test(taskId)) throw new WorkflowValidationError(422, 'INVALID_TASK', '无效任务编号');
      const row = await prisma.manualEvidenceTask.findFirst({ where: { id: taskId, workspaceId: ctx.workspaceId, projectId: ctx.projectId } });
      if (!row) throw new WorkflowValidationError(404, 'MANUAL_TASK_NOT_FOUND', '人工任务不存在');
      const events = await prisma.manualEvidenceTaskEvent.findMany({ where: { taskId }, orderBy: { version: 'asc' }, select: { version: true, action: true, actorId: true, reason: true, deliveryUrl: true, createdAt: true } });
      return NextResponse.json({ data: { task: manualView(row), events } }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const rows = await prisma.manualEvidenceTask.findMany({ where: { workspaceId: ctx.workspaceId, projectId: ctx.projectId }, orderBy: { createdAt: 'desc' }, take: 50 });
    return NextResponse.json({ data: rows.map(manualView) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}

export async function POST(req: Request) {
  try {
    const ctx = await context(true);
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { throw new WorkflowValidationError(400, 'INVALID_REQUEST', '无效请求'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new WorkflowValidationError(422, 'INVALID_REQUEST', '无效请求');
    let result;
    if (body.action === 'create') {
      if (Object.keys(body).some(key => !['action', 'approvalId'].includes(key)) || typeof body.approvalId !== 'string' || !/^[a-f0-9]{32}$/.test(body.approvalId)) throw new WorkflowValidationError(422, 'INVALID_APPROVAL', '无效审批编号');
      result = await createManualTask(ctx, body.approvalId, req.headers.get('x-visibility-authorization'));
    } else {
      if (Object.keys(body).some(key => !['action', 'taskId', 'expectedVersion', 'idempotencyKey', 'reason', 'deliveryUrl'].includes(key)) ||
          !['start', 'complete', 'cancel'].includes(String(body.action)) || typeof body.taskId !== 'string' || !/^[a-f0-9]{32}$/.test(body.taskId) ||
          !Number.isSafeInteger(body.expectedVersion) || Number(body.expectedVersion) < 1 || typeof body.idempotencyKey !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(body.idempotencyKey) ||
          typeof body.reason !== 'string' || body.reason.trim().length < 5 || body.reason.length > 2000 ||
          body.deliveryUrl !== undefined && (body.action !== 'complete' || typeof body.deliveryUrl !== 'string' || body.deliveryUrl.length > 4096)) throw new WorkflowValidationError(422, 'INVALID_CHANGE', '无效任务操作');
      if (body.deliveryUrl) {
        try { const url = new URL(String(body.deliveryUrl)); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('invalid'); }
        catch { throw new WorkflowValidationError(422, 'INVALID_DELIVERY', '无效交付地址'); }
      }
      result = await changeManualTask(ctx, body as ManualChange, req.headers.get('x-visibility-authorization'));
    }
    return NextResponse.json({ data: result.view, meta: { replayed: result.replayed, publicationAllowed: false } }, { status: result.replayed ? 200 : 202 });
  } catch (error) { return failure(error); }
}
