"use client";

import { useState, useEffect } from "react";

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
  onScheduleClick: (contentId: string) => void;
}

export default function UnscheduledPanel({
  workspaceId,
  onScheduleClick,
}: UnscheduledPanelProps) {
  const [unscheduledItems, setUnscheduledItems] = useState<UnscheduledContent[]>(
    []
  );

  useEffect(() => {
    fetchUnscheduledContent();
  }, [workspaceId]);

  const fetchUnscheduledContent = async () => {
    try {
      const response = await fetch(
        `/api/content?workspaceId=${workspaceId}&status=draft&unscheduled=true`
      );
      if (response.ok) {
        const data = await response.json();
        setUnscheduledItems(data);
      }
    } catch (error) {
      console.error("Failed to fetch unscheduled content:", error);
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

  return (
    <div className="bg-gray-50 p-4 space-y-3 overflow-y-auto">
      <h3 className="font-semibold text-sm text-gray-700">
        Unscheduled ({unscheduledItems.length})
      </h3>

      {unscheduledItems.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No unscheduled content</p>
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
                  onClick={() => onScheduleClick(item.id)}
                  className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Schedule
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
