"use client";

interface CalendarCardProps {
  id: string;
  title: string;
  platform?: string;
  status: string;
  scheduledAt: string;
  onClick: () => void;
  onDragStart: () => void;
}

export default function CalendarCard({
  id,
  title,
  platform,
  status,
  scheduledAt,
  onClick,
  onDragStart,
}: CalendarCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-100 border-blue-300 text-blue-800";
      case "publishing":
        return "bg-yellow-100 border-yellow-300 text-yellow-800";
      case "published":
        return "bg-green-100 border-green-300 text-green-800";
      case "failed":
        return "bg-red-100 border-red-300 text-red-800";
      default:
        return "bg-gray-100 border-gray-300 text-gray-800";
    }
  };

  const date = new Date(scheduledAt);
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={`p-2 rounded border cursor-pointer hover:shadow-md transition-shadow ${getStatusColor(
        status
      )}`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h4 className="font-medium text-sm truncate">{title}</h4>
          {platform && (
            <span className="text-xs opacity-75">{platform}</span>
          )}
        </div>
        <span className="text-xs">{timeStr}</span>
      </div>
    </div>
  );
}
