"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { zhCN } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { getMonthRange, getWeekRange } from "@/lib/dates";
import type { ContentSchedule } from "@/types";
import { useRouter } from "next/navigation";

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

  const onSelectEvent = useCallback((event: any) => {
    if (event?.resource?.contentPiece?.id) {
      // Navigate to content editor
      router.push(`/content/${event.resource.contentPiece.id}`);
    }
  }, [router]);

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
            <Calendar
              events={events}
              localizer={localizer}
              view={currentView}
              onView={setCurrentView}
              onNavigate={handleNavigate}
              onSelectEvent={onSelectEvent}
              defaultDate={new Date()}
              views={["month", "week", "day"]}
              defaultView={currentView}
              step={60}
              timeslots={8}
              showMultiDayTimes
              popup
              startAccessor="start"
              endAccessor="end"
              style={{ height: 600 }}
              components={{
                eventWrapper: (eventWrapperProps: any) => {
                  return (
                    <div
                      {...eventWrapperProps}
                      style={{
                        background: eventStyle(eventWrapperProps.event.resource?.contentPiece?.platform || "generic"),
                      }}
                    />
                  );
                },
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
