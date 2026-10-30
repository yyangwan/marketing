import { NextResponse } from 'next/server';
import { IMPLEMENTED_PROMPT_BUILDERS } from '@/lib/platforms/capabilities';
import { isContentWorkflowDisabled } from '@/lib/content-workflow/switch';

export async function GET() {
  const enabled = process.env.CONTENT_EVIDENCE_BRIEF_ENABLED === 'true';
  return NextResponse.json({ schemaVersion: 3, enabled,
    generateDraft: { enabled: enabled && !isContentWorkflowDisabled(), channels: Object.keys(IMPLEMENTED_PROMPT_BUILDERS) },
    manualTask: { enabled, channels: ['website', 'zhihu', 'toutiao'], generationQuota: 0 }, publicationAllowed: false }, { headers: { 'Cache-Control': 'no-store' } });
}
