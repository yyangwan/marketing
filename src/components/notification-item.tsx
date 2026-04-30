"use client";

import { formatRelativeTime } from "@/lib/dates";
import { Eye, CheckCircle2, Rocket, Calendar, MessageCircle, Bell } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationItemProps {
  notification: Notification;
  onClick: (notification: Notification) => void;
}

export default function NotificationItem({
  notification,
  onClick,
}: NotificationItemProps) {
  const getTypeIcon = (type: string) => {
    const iconProps = { className: "w-4 h-4", strokeWidth: 2 };
    switch (type) {
      case "content_review":
        return <Eye {...iconProps} />;
      case "content_approved":
        return <CheckCircle2 {...iconProps} />;
      case "content_published":
        return <Rocket {...iconProps} />;
      case "schedule_reminder":
        return <Calendar {...iconProps} />;
      case "mention":
        return <MessageCircle {...iconProps} />;
      default:
        return <Bell {...iconProps} />;
    }
  };

  return (
    <div
      onClick={() => onClick(notification)}
      className={`p-3 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
        !notification.isRead ? "bg-blue-50" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="text-gray-600 mt-0.5">{getTypeIcon(notification.type)}</div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium truncate">{notification.title}</h4>
          <p className="text-xs text-gray-600 line-clamp-2">
            {notification.message}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {formatRelativeTime(new Date(notification.createdAt))}
          </p>
        </div>
      </div>
    </div>
  );
}
