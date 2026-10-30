import { NextResponse } from "next/server";
import { getServiceSession } from "@/lib/auth/service-auth";
import { getServiceWorkspace } from "@/lib/auth/service-context";
import { checkedEvidenceBrief, evidenceToGenerationInput } from "@/lib/content-brief/evidence-v3";

export async function POST(req: Request) {
  if (process.env.CONTENT_EVIDENCE_BRIEF_ENABLED !== "true") return NextResponse.json({ error: "evidence_brief_disabled" }, { status: 503 });
  const session = await getServiceSession(), context = await getServiceWorkspace();
  if (!session?.user?.id || !context || context.userId !== session.user.id || context.scope !== "project" || !context.projectId) return NextResponse.json({ error: "project_scope_required" }, { status: 403 });
  let body: { approvalId?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_request" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => key !== "approvalId") || typeof body.approvalId !== "string" || !/^[a-f0-9]{32}$/.test(body.approvalId)) return NextResponse.json({ error: "invalid_approval" }, { status: 422 });
  const authorityToken = req.headers.get("x-visibility-authorization");
  if (!authorityToken?.startsWith("Bearer ") || authorityToken.length > 8192) return NextResponse.json({ error: "authority_verification_required" }, { status: 403 });
  try {
    const response = await fetch(`${process.env.VISIBILITY_SERVICE_URL || "http://127.0.0.1:8000"}/api/intelligence/draft-approvals/${body.approvalId}/brief`, {
      headers: { Authorization: authorityToken }, cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return NextResponse.json({ error: "evidence_authorization_unavailable_or_stale" }, { status: response.status >= 500 ? 503 : response.status });
    const brief = checkedEvidenceBrief(await response.json(), context.projectId, body.approvalId);
    return NextResponse.json({ data: { brief, generationInput: evidenceToGenerationInput(brief), status: "prepared", publicationAllowed: false } });
  } catch { return NextResponse.json({ error: "evidence_verification_failed" }, { status: 503 }); }
}
