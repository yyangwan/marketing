import { NextRequest, NextResponse } from 'next/server';
import { getServiceWorkspace } from '@/lib/auth/service-context';
import { prisma } from '@/lib/db';

const headers = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  const context = await getServiceWorkspace();
  const projectId = req.nextUrl.searchParams.get('projectId');
  if (context?.scope !== 'project' || !projectId || context.projectId !== projectId ||
    !['owner', 'admin', 'member'].includes(context.role)) {
    return NextResponse.json({ error: '需要当前项目权限。' }, { status: 403, headers });
  }

  try {
    const pieces = await prisma.contentPiece.findMany({
      where: { workspaceId: context.workspaceId, projectId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 2,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        platformContents: {
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { platform: true },
        },
      },
    });
    const items = pieces.map(({ platformContents, ...piece }) => ({
      ...piece,
      platform: platformContents[0]?.platform || 'generic',
    }));
    return NextResponse.json({ project_id: projectId, items }, { headers });
  } catch {
    return NextResponse.json({ error: '内容列表暂不可用。' }, { status: 503, headers });
  }
}
