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
    const doFetch = async () => {
      try {
        const response = await fetch(
          `/api/content?unscheduled=true`
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

    doFetch();

    // Poll every 10 seconds to refresh the list
    const interval = setInterval(doFetch, 10000);

    // Listen for custom refresh event from calendar
    const handleRefreshEvent = () => {
      doFetch();
    };

    window.addEventListener(CUSTOM_EVENTS.UNSCHEDULED_REFRESH, handleRefreshEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener(CUSTOM_EVENTS.UNSCHEDULED_REFRESH, handleRefreshEvent);
    };
  }, [workspaceId]);

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
    <div className="p-4 space-y-3 overflow-y-auto">
      <h3 className="font-semibold text-sm text-foreground">
        未排期 ({unscheduledItems.length})
      </h3>

      {unscheduledItems.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">暂无未排期内容</p>
      ) : (
        <div className="space-y-2">
          {unscheduledItems.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item.id)}
              className="p-2.5 bg-card rounded-md border border-border hover:shadow-sm transition-shadow cursor-move"
            >
              <div className="flex items-start gap-2">
                <span className="text-lg">{getPlatformIcon(item.platform)}</span>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-foreground truncate">{item.title}</h4>
                  <p className="text-xs text-muted-foreground">{item.type}</p>
                </div>
                <button
                  onClick={() => handleScheduleClick(item.id)}
                  className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
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
