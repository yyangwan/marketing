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
    <div className="h-screen flex flex-col">
      <header className="border-b p-4">
        <h1 className="text-2xl font-bold">Content Calendar</h1>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Calendar component */}
        <div className="flex-1">
          <CalendarClient workspaceId={ws.workspaceId} />
        </div>

        {/* Unscheduled sidebar */}
        <div className="w-80 border-l">
          <UnscheduledPanel workspaceId={ws.workspaceId} />
        </div>
      </main>
    </div>
  );
}
