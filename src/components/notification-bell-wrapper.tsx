"use client";

import NotificationBell from "@/components/notification-bell";

interface NotificationBellWrapperProps {
  workspaceId: string;
}

export default function NotificationBellWrapper({
  workspaceId,
}: NotificationBellWrapperProps) {
  return <NotificationBell workspaceId={workspaceId} />;
}
