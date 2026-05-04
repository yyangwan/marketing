import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import CalendarClient from "@/components/calendar-client";
import UnscheduledPanel from "@/components/unscheduled-panel";
import { getCurrentWorkspace } from "@/lib/auth/workspace";

export default async function CalendarPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    redirect("/setup");
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 py-4 border-b border-border bg-card">
        <h1 className="text-xl font-semibold text-foreground tracking-tight">内容日历</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          拖拽排期、管理发布计划
        </p>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Calendar component */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
          <CalendarClient workspaceId={ws.workspaceId} />
        </div>

        {/* Unscheduled sidebar — below on mobile, side panel on desktop */}
        <div className="md:w-72 md:border-l border-t md:border-t-0 border-border max-h-[300px] md:max-h-none overflow-y-auto">
          <UnscheduledPanel workspaceId={ws.workspaceId} />
        </div>
      </div>
    </div>
  );
}
