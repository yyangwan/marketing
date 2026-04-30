import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { LogOut, Settings, Plus, Bell } from "lucide-react";
import { Toaster } from "sonner";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { SignOutButton } from "@/components/sign-out-button";
import { FeedbackButton } from "@/components/feedback-button";
import NotificationBellWrapper from "@/components/notification-bell-wrapper";
import { initAnalytics } from "@/lib/analytics";
import Navigation from "@/components/Navigation";

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
    <html lang="zh-CN" className={`${geistSans.variable} h-screen antialiased`}>
      <body className="h-full flex bg-background overflow-hidden">
        {session && (
          <aside className="w-60 h-full bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 sticky top-0 self-start">
            <div className="px-4 py-4 border-b border-sidebar-border">
              <p className="text-xs text-muted-foreground">ContentOS</p>
              <Link href="/" className="text-lg font-semibold text-sidebar-foreground tracking-tight block mt-0.5">
                {workspaceName || "ContentOS"}
              </Link>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              <Navigation projects={projects} />

              {/* New project link */}
              <Link
                href="/projects/new"
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-sidebar-accent-foreground transition-colors duration-100"
              >
                <Plus className="w-3 h-3" />
                新建项目
              </Link>
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
        <main className="flex-1 h-full overflow-y-auto overflow-x-hidden">{children}</main>
        <Toaster position="top-right" richColors closeButton />
        <FeedbackButton />
      </body>
    </html>
  );
}
