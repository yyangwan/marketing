"use client";

import { useState } from "react";

interface ScheduleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (date: Date, time: string) => void;
  platform?: string;
}

const PLATFORM_DEFAULTS: Record<string, string> = {
  wechat: "08:00",    // Morning reading
  weibo: "12:00",     // Lunch scroll
  xiaohongshu: "20:00", // Evening browse
  douyin: "18:00",    // Commute home
};

export default function ScheduleDialog({
  isOpen,
  onClose,
  onSchedule,
  platform,
}: ScheduleDialogProps) {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>(
    platform ? PLATFORM_DEFAULTS[platform] || "09:00" : "09:00"
  );

  if (!isOpen) return null;

  // Default to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split("T")[0];

  const handleSubmit = () => {
    if (!selectedDate) return;

    const dateTime = new Date(`${selectedDate}T${selectedTime}`);
    onSchedule(dateTime, selectedTime);
    onClose();
  };

  const timeOptions = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const timeStr = `${String(hour).padStart(2, "0")}:${String(min).padStart(
        2,
        "0"
      )}`;
      timeOptions.push(timeStr);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">排期内容</h2>

        <div className="space-y-4">
          {/* Date picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              日期
            </label>
            <input
              type="date"
              value={selectedDate || defaultDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {/* Time picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              时间
            </label>
            <select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              {timeOptions.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
            {platform && PLATFORM_DEFAULTS[platform] && (
              <p className="text-xs text-gray-500 mt-1">
                {platform} 最佳发布时间：{PLATFORM_DEFAULTS[platform]}
              </p>
            )}
          </div>

          {/* Preview */}
          {selectedDate && (
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-sm text-gray-600">
                计划发布时间：{" "}
                <strong>
                  {new Date(`${selectedDate}T${selectedTime}`).toLocaleString()}
                </strong>
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            确认排期
          </button>
        </div>
      </div>
    </div>
  );
}
