"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Settings, Plus, LogOut } from "lucide-react";
import Navigation from "./Navigation";
import { SignOutButton } from "./sign-out-button";
import NotificationBellWrapper from "./notification-bell-wrapper";

interface MobileLayoutProps {
  children: React.ReactNode;
  workspaceName: string | null;
  projects: { id: string; name: string }[];
  session: {
    user?: {
      name?: string | null;
      email?: string | null;
      workspaceId?: string;
    };
  };
}

export default function MobileLayout({
  children,
  workspaceName,
  projects,
  session,
}: MobileLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const closeSidebar = () => setSidebarOpen(false);

  // Close sidebar on navigation
  const currentPathname = pathname;

  const sidebarContent = (
    <>
      <div className="px-4 py-4 border-b border-sidebar-border">
        <p className="text-xs text-muted-foreground">ContentOS</p>
        <Link
          href="/"
          className="text-lg font-semibold text-sidebar-foreground tracking-tight block mt-0.5"
          onClick={closeSidebar}
        >
          {workspaceName || "ContentOS"}
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <Navigation projects={projects} />
        <Link
          href="/projects/new"
          onClick={closeSidebar}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-sidebar-accent-foreground transition-colors duration-100"
        >
          <Plus className="w-3 h-3" />
          新建项目
        </Link>
      </nav>
      <div className="px-3 py-2 border-t border-sidebar-border flex items-center justify-between">
        <Link
          href="/settings"
          onClick={closeSidebar}
          className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-100"
        >
          <Settings className="w-4 h-4" />
          设置
        </Link>
        {session?.user?.workspaceId && (
          <NotificationBellWrapper workspaceId={session.user.workspaceId} />
        )}
      </div>
      <div className="px-4 py-3 border-t border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">
              {session.user?.name}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {session.user?.email}
            </p>
          </div>
          <SignOutButton />
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar — hidden on md+ */}
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-sidebar border-b border-sidebar-border">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"
          aria-label="打开菜单"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/" className="text-sm font-semibold text-sidebar-foreground">
          {workspaceName || "ContentOS"}
        </Link>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeSidebar}
          />
          <aside className="absolute inset-y-0 left-0 w-60 bg-sidebar flex flex-col animate-slide-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
              <span className="text-sm font-semibold text-sidebar-foreground">菜单</span>
              <button
                onClick={closeSidebar}
                className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"
                aria-label="关闭菜单"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex-1 h-full flex overflow-hidden">
        {/* Desktop sidebar — hidden on mobile */}
        <aside className="hidden md:flex w-60 h-full bg-sidebar border-r border-sidebar-border flex-col shrink-0 sticky top-0 self-start">
          {sidebarContent}
        </aside>

        <main className="flex-1 h-full overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </>
  );
}
