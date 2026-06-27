import { auth } from "@/lib/auth/config";
import { buildGeniLinkLoginUrl } from "@/lib/auth/genilink-login";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import CalendarClient from "@/components/calendar-client";
import UnscheduledPanel from "@/components/unscheduled-panel";

export default async function CalendarPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect(buildGeniLinkLoginUrl("/calendar"));
  }

  const cookieStore = await cookies();
  const workspaceId = session.user.workspaceId ?? cookieStore.get("genilink-workspace")?.value;
  if (!workspaceId) {
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
          <CalendarClient workspaceId={workspaceId} />
        </div>

        {/* Unscheduled sidebar — below on mobile, side panel on desktop */}
        <div className="md:w-72 md:border-l border-t md:border-t-0 border-border max-h-[300px] md:max-h-none overflow-y-auto">
          <UnscheduledPanel workspaceId={workspaceId} />
        </div>
      </div>
    </div>
  );
}
