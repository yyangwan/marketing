"use client";

import { formatRelativeTime } from "@/lib/dates";

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
    switch (type) {
      case "content_review":
        return "👀";
      case "content_approved":
        return "✅";
      case "content_published":
        return "🚀";
      case "schedule_reminder":
        return "📅";
      case "mention":
        return "💬";
      default:
        return "🔔";
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
        <span className="text-lg">{getTypeIcon(notification.type)}</span>
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
