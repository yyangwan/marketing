import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { SettingsNav } from "@/components/settings-nav";
import { Building, Sparkles, Send, Users, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const settingsItems = [
  { href: "/settings", label: "工作空间", icon: "building" as const },
  { href: "/settings/members", label: "成员管理", icon: "users" as const },
  { href: "/settings/brand-voice", label: "品牌调性", icon: "sparkles" as const },
  { href: "/settings/publishing", label: "发布设置", icon: "send" as const },
  { href: "/settings/profile", label: "个人资料", icon: "user" as const },
];

const iconMap: Record<string, LucideIcon> = {
  building: Building,
  users: Users,
  sparkles: Sparkles,
  send: Send,
  user: User,
};

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    redirect("/login");
  }

  return (
    <div className="flex gap-8 p-6 max-w-6xl mx-auto">
      {/* Sidebar Navigation */}
      <aside className="w-48 shrink-0">
        <nav className="space-y-1">
          {settingsItems.map((item) => {
            const Icon = iconMap[item.icon];
            return (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors duration-100"
              >
                {Icon && <Icon className="w-4 h-4" />}
                {item.label}
              </a>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
