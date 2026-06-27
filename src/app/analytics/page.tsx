import { auth } from "@/lib/auth/config";
import { buildGeniLinkLoginUrl } from "@/lib/auth/genilink-login";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(buildGeniLinkLoginUrl("/analytics"));
  }

  const cookieStore = await cookies();
  const workspaceId = session.user.workspaceId ?? cookieStore.get("genilink-workspace")?.value;
  if (!workspaceId) {
    redirect(buildGeniLinkLoginUrl("/analytics"));
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border bg-card">
        <h1 className="text-xl font-semibold text-foreground tracking-tight">数据统计</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          查看内容运营数据和质量趋势
        </p>
      </div>
      <AnalyticsDashboard workspaceId={workspaceId} />
    </div>
  );
}
