import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { LayoutDashboard, FileText, LogOut, Settings, FolderOpen, Plus, Calendar, Bell } from "lucide-react";
import { Toaster } from "sonner";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { SignOutButton } from "@/components/sign-out-button";
import { FeedbackButton } from "@/components/feedback-button";
import NotificationBellWrapper from "@/components/notification-bell-wrapper";
import { initAnalytics } from "@/lib/analytics";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ContentOS — AI 内容营销平台",
  description: "一站式 AI 内容创作、协作与发布平台",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Initialize analytics (client-side only)
  if (typeof window !== "undefined") {
    initAnalytics();
  }

  const session = await auth();

  let workspaceName: string | null = null;
  let projects: { id: string; name: string }[] = [];

  if (session?.user?.workspaceId) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: session.user.workspaceId },
    });
    workspaceName = workspace?.name ?? null;

    projects = await prisma.project.findMany({
      where: { workspaceId: session.user.workspaceId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    });
  }

  return (
    <html lang="zh-CN" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex bg-background">
        {session && (
          <aside className="w-60 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
            <div className="px-4 py-4 border-b border-sidebar-border">
              <p className="text-xs text-muted-foreground">ContentOS</p>
              <Link href="/" className="text-lg font-semibold text-sidebar-foreground tracking-tight block mt-0.5">
                {workspaceName || "ContentOS"}
              </Link>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              <Link
                href="/"
                className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-md bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              >
                <LayoutDashboard className="w-4 h-4" />
                看板
              </Link>
              <Link
                href="/calendar"
                className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-100"
              >
                <Calendar className="w-4 h-4" />
                日历
              </Link>
              <Link
                href="/brief/new"
                className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-100"
              >
                <FileText className="w-4 h-4" />
                新建 Brief
              </Link>

              {/* Project list */}
              <div className="pt-3">
                <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">项目</p>
                <div className="mt-1 space-y-0.5 max-h-[200px] overflow-y-auto">
                  {projects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-100"
                    >
                      <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{project.name}</span>
                    </Link>
                  ))}
                </div>
                <Link
                  href="/projects/new"
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-sidebar-accent-foreground transition-colors duration-100"
                >
                  <Plus className="w-3 h-3" />
                  新建项目
                </Link>
              </div>
            </nav>
            <div className="px-3 py-2 border-t border-sidebar-border flex items-center justify-between">
              <Link
                href="/settings"
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
                  <p className="text-xs font-medium text-sidebar-foreground truncate">{session.user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{session.user?.email}</p>
                </div>
                <SignOutButton />
              </div>
            </div>
          </aside>
        )}
        <main className="flex-1 overflow-hidden">{children}</main>
        <Toaster position="top-right" richColors closeButton />
        <FeedbackButton />
      </body>
    </html>
  );
}
