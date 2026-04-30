"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Calendar, FileText, FolderOpen } from "lucide-react";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const mainNavItems: NavItem[] = [
  { href: "/", icon: LayoutDashboard, label: "看板" },
  { href: "/calendar", icon: Calendar, label: "日历" },
  { href: "/brief/new", icon: FileText, label: "新建 Brief" },
];

interface NavigationProps {
  projects: Array<{ id: string; name: string }>;
}

export default function Navigation({ projects }: NavigationProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {mainNavItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors duration-100 ${
            isActive(item.href)
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          }`}
        >
          <item.icon className="w-4 h-4" />
          {item.label}
        </Link>
      ))}

      {/* Project list */}
      <div className="pt-3">
        <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          项目
        </p>
        <div className="mt-1 space-y-0.5 max-h-[200px] overflow-y-auto">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors duration-100 ${
                isActive(`/projects/${project.id}`)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{project.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
