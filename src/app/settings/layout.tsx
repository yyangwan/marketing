import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { SettingsNav } from "@/components/settings-nav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    redirect("/login");
  }

  const settingsItems = [
    { href: "/settings", label: "工作空间", icon: "building" },
    { href: "/settings/brand-voice", label: "品牌调性", icon: "sparkles" },
    { href: "/settings/publishing", label: "发布设置", icon: "send" },
  ];

  return (
    <div className="flex gap-8 p-6 max-w-6xl mx-auto">
      {/* Sidebar Navigation */}
      <aside className="w-48 shrink-0">
        <nav className="space-y-1">
          <SettingsNav items={settingsItems} />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
