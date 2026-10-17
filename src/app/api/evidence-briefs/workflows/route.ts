import { NextResponse } from 'next/server';
import { getServiceSession } from '@/lib/auth/service-auth';
import { getServiceWorkspace } from '@/lib/auth/service-context';
import { createEvidenceWorkflow } from '@/lib/content-workflow/evidence-service';
import { EvidenceAuthorityError } from '@/lib/content-workflow/evidence-authority';
import { WorkflowValidationError } from '@/lib/content-workflow/service';
import { isContentWorkflowDisabled } from '@/lib/content-workflow/switch';

export async function POST(req: Request) {
  if (process.env.CONTENT_EVIDENCE_BRIEF_ENABLED !== 'true' || isContentWorkflowDisabled()) return NextResponse.json({ error: 'evidence_generation_disabled' }, { status: 503 });
  const session = await getServiceSession(), context = await getServiceWorkspace();
  if (!session?.user?.id || !context || context.userId !== session.user.id || context.scope !== 'project' || !context.projectId || !['owner', 'admin', 'editor', 'member'].includes(context.role || '')) return NextResponse.json({ error: 'project_write_required' }, { status: 403 });
  let body: { approvalId?: unknown; usageOperationId?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_request' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['approvalId', 'usageOperationId'].includes(key)) ||
      typeof body.approvalId !== 'string' || !/^[a-f0-9]{32}$/.test(body.approvalId) || typeof body.usageOperationId !== 'string' || !/^evidence-draft:[a-f0-9]{64}$/.test(body.usageOperationId)) return NextResponse.json({ error: 'invalid_request' }, { status: 422 });
  try {
    const result = await createEvidenceWorkflow({ workspaceId: context.workspaceId, projectId: context.projectId, userId: session.user.id }, { approvalId: body.approvalId, usageOperationId: body.usageOperationId });
    // The existing cron worker executes committed jobs; HTTP lifetime does not own generation.
    return NextResponse.json({ data: result.view, meta: { replayed: result.replayed, publicationAllowed: false } }, { status: result.replayed ? 200 : 202 });
  } catch (error) {
    if (error instanceof WorkflowValidationError) return NextResponse.json({ error: error.code }, { status: error.status });
    if (error instanceof EvidenceAuthorityError) return NextResponse.json({ error: error.code }, { status: error.retryable ? 503 : 409 });
    return NextResponse.json({ error: 'evidence_workflow_unavailable' }, { status: 503 });
  }
}
