import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
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
    <div className="flex flex-col md:flex-row gap-0 md:gap-8 p-4 md:p-6 max-w-6xl mx-auto">
      {/* Mobile: horizontal scrollable tabs */}
      <nav className="md:hidden flex gap-1 overflow-x-auto border-b border-border pb-2 mb-4 -mx-4 px-4">
        {settingsItems.map((item) => {
          const Icon = iconMap[item.icon];
          return (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors duration-100 whitespace-nowrap"
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              {item.label}
            </a>
          );
        })}
      </nav>

      {/* Desktop: sidebar navigation */}
      <aside className="hidden md:block w-48 shrink-0">
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
