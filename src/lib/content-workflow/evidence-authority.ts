import { getPortalBaseUrl, getUsageCallbackSecret } from '@/lib/config/portal';
import { checkedEvidenceBrief, type EvidenceBriefV3 } from '@/lib/content-brief/evidence-v3';
import { requestHash } from '@/lib/contracts/hash';

export class EvidenceAuthorityError extends Error {
  constructor(public readonly code: string, public readonly retryable: boolean) { super(code); }
}

export async function verifyWorkflowEvidence(params: { operationId: string; workspaceId: string; projectId: string; approvalId: string; snapshot?: EvidenceBriefV3 }): Promise<EvidenceBriefV3> {
  if (process.env.CONTENT_EVIDENCE_BRIEF_ENABLED !== 'true') throw new EvidenceAuthorityError('EVIDENCE_DISABLED', true);
  const secret = getUsageCallbackSecret();
  if (!secret) throw new EvidenceAuthorityError('EVIDENCE_CALLBACK_UNCONFIGURED', true);
  let response: Response, raw: unknown;
  try {
    response = await fetch(`${getPortalBaseUrl()}/api/internal/content-evidence/verify`, {
      method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ operationId: params.operationId, workspaceId: params.workspaceId, projectId: params.projectId, approvalId: params.approvalId }),
      signal: AbortSignal.timeout(12000), cache: 'no-store',
    });
    raw = await response.json();
  } catch { throw new EvidenceAuthorityError('EVIDENCE_AUTHORITY_UNAVAILABLE', true); }
  if (!response.ok) throw new EvidenceAuthorityError(response.status >= 500 ? 'EVIDENCE_AUTHORITY_UNAVAILABLE' : 'EVIDENCE_AUTHORIZATION_STALE', response.status >= 500);
  let brief: EvidenceBriefV3;
  try { brief = checkedEvidenceBrief((raw as { data?: { brief?: unknown } })?.data?.brief, params.projectId, params.approvalId); }
  catch { throw new EvidenceAuthorityError('EVIDENCE_AUTHORITY_INVALID', false); }
  if (params.snapshot && requestHash(params.snapshot) !== requestHash(brief)) throw new EvidenceAuthorityError('EVIDENCE_SNAPSHOT_CHANGED', false);
  return brief;
}
