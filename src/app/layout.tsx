import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { FeedbackButton } from "@/components/feedback-button";
import { initAnalytics } from "@/lib/analytics";
import MobileLayout from "@/components/mobile-layout";

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
    const [workspace, projectsData] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: session.user.workspaceId },
      }),
      prisma.project.findMany({
        where: { workspaceId: session.user.workspaceId },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true },
      }),
    ]);
    workspaceName = workspace?.name ?? null;
    projects = projectsData;
  }

  if (!session) {
    return (
      <html lang="zh-CN" className={`${geistSans.variable} h-screen antialiased`}>
        <body className="h-full bg-background">
          {children}
          <Toaster position="top-right" richColors closeButton />
        </body>
      </html>
    );
  }

  return (
    <html lang="zh-CN" className={`${geistSans.variable} h-screen antialiased`}>
      <body className="h-full flex flex-col bg-background overflow-hidden">
        <MobileLayout
          workspaceName={workspaceName}
          projects={projects}
          session={session}
        >
          {children}
        </MobileLayout>
        <Toaster position="top-right" richColors closeButton />
        <FeedbackButton />
      </body>
    </html>
  );
}
