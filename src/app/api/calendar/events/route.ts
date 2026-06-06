import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServiceSession } from "@/lib/auth/service-auth";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { getServiceWorkspace } from "@/lib/auth/service-context";

// GET /api/calendar/events - Get scheduled content for calendar view
export async function GET(req: Request) {
  const session = await getServiceSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ws = (await headers()).get("x-genilink-project-id") ? await getServiceWorkspace() : getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const projectId = url.searchParams.get("projectId");
  const status = url.searchParams.get("status");

  if (!start || !end) {
    return NextResponse.json(
      { error: "invalid_input", message: "start and end are required" },
      { status: 400 }
    );
  }

  const startDate = new Date(start);
  const endDate = new Date(end);

  try {
    // Build where clause
    const where: any = {
      scheduledAt: {
        gte: startDate,
        lte: endDate,
      },
      contentPiece: {
        workspaceId: ws.workspaceId,
      },
    };

    // Add projectId filter if provided
    if (projectId) {
      where.contentPiece.projectId = projectId;
    }

    // Add status filter if provided
    if (status) {
      where.contentPiece.status = status;
    }

    const schedules = await prisma.contentSchedule.findMany({
      where,
      include: {
        contentPiece: true,
      },
      orderBy: { scheduledAt: "asc" },
    });

    return NextResponse.json(schedules);
  } catch (error) {
    console.error("Failed to fetch calendar events:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar events" },
      { status: 500 }
    );
  }
}
