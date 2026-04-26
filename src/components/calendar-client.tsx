"use client";

import { useState, useEffect, useMemo } from "react";
import { ScheduleXCalendar, useCalendarApp } from "@schedule-x/react";
import { createCalendar, viewWeek, viewMonthGrid, viewDay } from "@schedule-x/calendar";
import { formatDate, getMonthRange, getWeekRange } from "@/lib/dates";
import type { ContentSchedule } from "@/types";

interface CalendarClientProps {
  initialView?: "month" | "week" | "day";
  workspaceId: string;
}

export default function CalendarClient({
  initialView = "month",
  workspaceId,
}: CalendarClientProps) {
  const [currentView, setCurrentView] = useState<"month" | "week" | "day">(initialView);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<ContentSchedule[]>([]);
  const [filterProject, setFilterProject] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  // Map view names to schedule-x view plugins
  const viewPlugin = useMemo(() => {
    switch (currentView) {
      case "week":
        return viewWeek;
      case "day":
        return viewDay;
      case "month":
      default:
        return viewMonthGrid;
    }
  }, [currentView]);

  // Create calendar configuration - pass as individual arguments for useCalendarApp
  const calendarApp = useCalendarApp({
    views: [viewWeek, viewMonthGrid, viewDay],
    selectedDate: selectedDate,
    events: events.map((e) => ({
      id: e.id,
      title: e.contentPiece?.title || "Untitled",
      start: e.scheduledAt.toISOString(),
      end: e.publishedAt?.toISOString(),
    })),
  });

  // Fetch scheduled content for visible date range
  useEffect(() => {
    fetchScheduledContent();
  }, [selectedDate, currentView, filterProject, filterStatus]);

  const fetchScheduledContent = async () => {
    try {
      const range =
        currentView === "month" ? getMonthRange(selectedDate) : getWeekRange(selectedDate);

      const params = new URLSearchParams({
        start: range.start.toISOString(),
        end: range.end.toISOString(),
        ...(filterProject && { projectId: filterProject }),
        ...(filterStatus && { status: filterStatus }),
      });

      const response = await fetch(`/api/calendar/events?${params}`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    } catch (error) {
      console.error("Failed to fetch calendar events:", error);
    }
  };

  return (
    <div className="h-full flex">
      {/* Filters sidebar */}
      <div className="w-64 border-r p-4 space-y-4">
        <h3 className="font-semibold">Filters</h3>

        {/* Project filter */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Project</label>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="w-full border rounded px-2 py-1"
          >
            <option value="">All Projects</option>
            {/* Projects would be loaded here */}
          </select>
        </div>

        {/* Status filter */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full border rounded px-2 py-1"
          >
            <option value="">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="publishing">Publishing</option>
            <option value="published">Published</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {/* View toggle */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">View</label>
          <div className="flex gap-1">
            {(["month", "week", "day"] as const).map((view) => (
              <button
                key={view}
                onClick={() => setCurrentView(view)}
                className={`flex-1 px-2 py-1 text-sm rounded ${
                  currentView === view
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100"
                }`}
              >
                {view.charAt(0).toUpperCase() + view.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1">
        {calendarApp && (
          <ScheduleXCalendar calendarApp={calendarApp} />
        )}
      </div>
    </div>
  );
}
