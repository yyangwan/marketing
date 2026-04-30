"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, dateFnsLocalizer, Views, View } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { zhCN } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { getMonthRange, getWeekRange } from "@/lib/dates";
import type { ContentSchedule } from "@/types";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CalendarClientProps {
  initialView?: "month" | "week" | "day";
  workspaceId: string;
}

// Setup the localizer
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { "zh-CN": zhCN },
});

// Event style helper
function eventStyle(platform: string) {
  const colors: Record<string, string> = {
    wechat: "#16a34a",    // green-600
    weibo: "#dc2626",     // red-600
    xiaohongshu: "#ec4899", // pink-500
    douyin: "#000000",    // black
    generic: "#6b7280",   // gray-500
  };
  return colors[platform] || colors.generic;
}

// Create drag-and-drop calendar wrapper
const DnDCalendar = withDragAndDrop(Calendar);

export default function CalendarClient({
  initialView = "month",
  workspaceId,
}: CalendarClientProps) {
  const [currentView, setCurrentView] = useState<"month" | "week" | "day">(initialView);
  const [events, setEvents] = useState<any[]>([]);
  const [filterProject, setFilterProject] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [draggedContentId, setDraggedContentId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const router = useRouter();

  // Fetch projects for filter dropdown
  useEffect(() => {
    async function fetchProjects() {
      try {
        const response = await fetch(`/api/projects?workspaceId=${workspaceId}`);
        if (response.ok) {
          const data = await response.json();
          setProjects(data);
        }
      } catch (error) {
        console.error("Failed to fetch projects:", error);
      }
    }
    fetchProjects();
  }, [workspaceId]);

  // Listen for drag events from unscheduled panel
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      const contentId = e.dataTransfer?.getData("contentId");
      if (contentId) {
        setDraggedContentId(contentId);
      }
    };

    const handleDragEnd = () => {
      setDraggedContentId(null);
    };

    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("drop", handleDrop);
    document.addEventListener("dragend", handleDragEnd);

    return () => {
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("drop", handleDrop);
      document.removeEventListener("dragend", handleDragEnd);
    };
  }, []);

  // Fetch scheduled content for visible date range
  const fetchScheduledContent = useCallback(async () => {
    try {
      setLoading(true);
      const today = new Date();
      const range =
        currentView === "month" ? getMonthRange(today) : getWeekRange(today);

      const params = new URLSearchParams({
        start: range.start.toISOString(),
        end: range.end.toISOString(),
        ...(filterProject && { projectId: filterProject }),
        ...(filterStatus && { status: filterStatus }),
      });

      const response = await fetch(`/api/calendar/events?${params}`);
      if (response.ok) {
        const data = await response.json();

        // Transform to react-big-calendar event format
        const calendarEvents = data.map((e: ContentSchedule) => {
          const startDate = new Date(e.scheduledAt);
          const endDate = e.publishedAt ? new Date(e.publishedAt) : new Date(startDate.getTime() + 60 * 60 * 1000); // Default 1 hour duration

          return {
            id: e.id,
            title: e.contentPiece?.title || "Untitled",
            start: startDate,
            end: endDate,
            resource: e,
          };
        });

        setEvents(calendarEvents);
      } else {
        console.error('[Calendar] API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error("Failed to fetch calendar events:", error);
    } finally {
      setLoading(false);
    }
  }, [currentView, filterProject, filterStatus]);

  useEffect(() => {
    fetchScheduledContent();
  }, [fetchScheduledContent]);

  const handleNavigate = useCallback(() => {
    fetchScheduledContent();
  }, [fetchScheduledContent]);

  const handleViewChange = useCallback((view: View) => {
    // Only allow month, week, day views
    if (view === "month" || view === "week" || view === "day") {
      setCurrentView(view);
    }
  }, []);

  const onSelectEvent = useCallback((event: any) => {
    if (event?.resource?.contentPiece?.id) {
      // Show dialog instead of directly navigating
      setSelectedEvent(event);
      setIsDialogOpen(true);
    }
  }, []);

  const handleUnschedule = async () => {
    if (!selectedEvent?.resource?.contentPiece?.id) return;

    const contentId = selectedEvent.resource.contentPiece.id;

    try {
      const response = await fetch(`/api/content/${contentId}/schedule`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Refresh events
        handleNavigate();
        setIsDialogOpen(false);
        setSelectedEvent(null);
      } else {
        console.error("Failed to unschedule:", response.status);
      }
    } catch (error) {
      console.error("Error unscheduling:", error);
    }
  };

  const handleOpenDetails = () => {
    if (selectedEvent?.resource?.contentPiece?.id) {
      router.push(`/content/${selectedEvent.resource.contentPiece.id}`);
    }
    setIsDialogOpen(false);
    setSelectedEvent(null);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with filters */}
      <div className="border-b bg-white p-4 flex gap-4 flex-wrap">
        <div className="min-w-[160px]">
          <label className="block text-sm text-gray-600 mb-1">项目</label>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="border rounded px-2 py-1 text-sm w-full"
          >
            <option value="">全部项目</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="min-w-[160px]">
          <label className="block text-sm text-gray-600 mb-1">状态</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border rounded px-2 py-1 text-sm w-full"
          >
            <option value="">全部状态</option>
            <option value="scheduled">已排期</option>
            <option value="publishing">发布中</option>
            <option value="published">已发布</option>
            <option value="failed">失败</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">视图</label>
          <div className="flex gap-1">
            {(["month", "week", "day"] as const).map((view) => (
              <button
                key={view}
                onClick={() => setCurrentView(view)}
                className={`px-3 py-1 text-sm rounded ${
                  currentView === view
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100"
                }`}
              >
                {view === "month" ? "月" : view === "week" ? "周" : "日"}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto text-sm text-gray-500">
          {events.length} 个日程
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 p-2 sm:p-4 bg-gray-50" style={{ minHeight: "500px" }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">加载日历中...</p>
          </div>
        ) : (
          <div className="bg-white rounded shadow p-2 sm:p-4" style={{ height: "600px" }}>
            <DnDCalendar
              localizer={localizer}
              events={events}
              view={currentView}
              onView={handleViewChange}
              onNavigate={handleNavigate}
              onSelectEvent={onSelectEvent}
              onEventDrop={async ({ event, start, end }: any) => {
                const { resource } = event;
                const startDate = new Date(start);

                try {
                  const response = await fetch(`/api/content/${resource.contentPiece.id}/schedule`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      scheduledAt: startDate.toISOString(),
                    }),
                  });

                  if (response.ok) {
                    handleNavigate();
                  } else {
                    console.error("Failed to update schedule:", response.status);
                  }
                } catch (error) {
                  console.error("Error dropping event:", error);
                }
              }}
              onDropFromOutside={async ({ start, end, allDay }: any) => {
                if (!draggedContentId) {
                  console.warn("No contentId found - drag may not have started from unscheduled panel");
                  return;
                }

                const startDate = new Date(start);

                try {
                  const response = await fetch(`/api/content/${draggedContentId}/schedule`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      scheduledAt: startDate.toISOString(),
                    }),
                  });

                  if (response.ok) {
                    handleNavigate();
                  } else {
                    console.error("Failed to schedule content:", response.status);
                  }
                } catch (error) {
                  console.error("Error scheduling content:", error);
                }
              }}
              defaultDate={new Date()}
              views={["month", "week", "day"]}
              defaultView={currentView}
              step={60}
              timeslots={8}
              showMultiDayTimes
              popup
              draggableAccessor={() => true}
              resizable
              selectable
              style={{ height: 600 }}
              components={{
                event: (eventProps: any) => {
                  const handleClick = (e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelectEvent(eventProps.event);
                  };

                  return (
                    <div
                      onClick={handleClick}
                      title={eventProps.title}
                      style={{
                        background: eventStyle(eventProps.event.resource?.contentPiece?.platform || "generic"),
                        padding: "2px 4px",
                        borderRadius: "3px",
                        color: "white",
                        fontSize: "12px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                        height: "100%",
                      }}
                    >
                      {eventProps.title}
                    </div>
                  );
                },
              }}
            />
          </div>
        )}
      </div>

      {/* Event action dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>日程操作</DialogTitle>
            <DialogDescription>
              选择要对此日程执行的操作
            </DialogDescription>
          </DialogHeader>

          {selectedEvent && (
            <div className="py-4">
              <p className="text-sm text-gray-600">
                <strong>{selectedEvent.title}</strong>
              </p>
              <p className="text-xs text-gray-500">
                {new Date(selectedEvent.start).toLocaleString("zh-CN")}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              取消
            </Button>
            <Button variant="default" onClick={handleUnschedule} className="bg-red-500 hover:bg-red-600">
              取消排期
            </Button>
            <Button variant="default" onClick={handleOpenDetails}>
              查看详情
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
