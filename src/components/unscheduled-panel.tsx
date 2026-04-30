"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CUSTOM_EVENTS } from "@/lib/events";

interface UnscheduledContent {
  id: string;
  title: string;
  type: string;
  platform?: string;
  status: string;
  createdAt: string;
}

interface UnscheduledPanelProps {
  workspaceId: string;
}

export default function UnscheduledPanel({
  workspaceId,
}: UnscheduledPanelProps) {
  const router = useRouter();
  const [unscheduledItems, setUnscheduledItems] = useState<UnscheduledContent[]>(
    []
  );

  useEffect(() => {
    fetchUnscheduledContent();

    // Poll every 10 seconds to refresh the list
    const interval = setInterval(fetchUnscheduledContent, 10000);

    // Listen for custom refresh event from calendar
    const handleRefreshEvent = () => {
      fetchUnscheduledContent();
    };

    window.addEventListener(CUSTOM_EVENTS.UNSCHEDULED_REFRESH, handleRefreshEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener(CUSTOM_EVENTS.UNSCHEDULED_REFRESH, handleRefreshEvent);
    };
  }, [workspaceId]);

  const fetchUnscheduledContent = async () => {
    try {
      const response = await fetch(
        `/api/content?workspaceId=${workspaceId}&status=draft&unscheduled=true`
      );
      if (response.ok) {
        const data = await response.json();
        setUnscheduledItems(data);
      } else {
        toast.error("Failed to load unscheduled content");
      }
    } catch (error) {
      console.error("Failed to fetch unscheduled content:", error);
      toast.error("Failed to load unscheduled content");
    }
  };

  const handleDragStart = (e: React.DragEvent, contentId: string) => {
    e.dataTransfer.setData("contentId", contentId);
  };

  const getPlatformIcon = (platform?: string) => {
    switch (platform) {
      case "wechat":
        return "💬";
      case "weibo":
        return "📱";
      case "xiaohongshu":
        return "📕";
      case "douyin":
        return "🎵";
      default:
        return "📄";
    }
  };

  const handleScheduleClick = (contentId: string) => {
    // Navigate to the content editor for scheduling
    router.push(`/content/${contentId}`);
  };

  return (
    <div className="bg-gray-50 p-4 space-y-3 overflow-y-auto">
      <h3 className="font-semibold text-sm text-gray-700">
        未排期 ({unscheduledItems.length})
      </h3>

      {unscheduledItems.length === 0 ? (
        <p className="text-sm text-gray-500 italic">暂无未排期内容</p>
      ) : (
        <div className="space-y-2">
          {unscheduledItems.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item.id)}
              className="p-2 bg-white rounded border hover:shadow-sm transition-shadow cursor-move"
            >
              <div className="flex items-start gap-2">
                <span className="text-lg">{getPlatformIcon(item.platform)}</span>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium truncate">{item.title}</h4>
                  <p className="text-xs text-gray-500">{item.type}</p>
                </div>
                <button
                  onClick={() => handleScheduleClick(item.id)}
                  className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  排期
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
