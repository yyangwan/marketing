import Link from "next/link";
import type { ContentStatus, Platform } from "@/types";
import { STATUS_COLUMNS, PLATFORM_CONFIG } from "@/types";
import { Link as LinkIcon, MessageSquare, CheckCircle, AlertCircle } from "lucide-react";

interface ReviewAction {
  action: string;
  authorName: string;
  comment?: string;
  createdAt: string;
}

interface CardPiece {
  id: string;
  title: string;
  status: string;
  reviewToken: string | null;
  platformContents: { platform: string }[];
  _count: { reviewComments: number };
  _lastReviewAction: ReviewAction | null;
  project?: { id: string; name: string } | null;
}

interface CardProps {
  piece: CardPiece;
  onStatusChange: (id: string, status: ContentStatus) => void;
  showProject?: boolean;
}

export function KanbanCard({ piece, onStatusChange, showProject }: CardProps) {
  const platforms = piece.platformContents.map((pc) => pc.platform as Platform);
  const statusConfig = STATUS_COLUMNS.find((s) => s.key === piece.status);
  const hasReviewLink = !!piece.reviewToken;
  const lastAction = piece._lastReviewAction;

  return (
    <div className="bg-card rounded-lg border border-border p-3 shadow-sm hover:shadow-md transition-shadow duration-100 group">
      {showProject && piece.project?.name && (
        <p className="text-xs text-secondary mb-1">{piece.project.name}</p>
      )}
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link
          href={`/content/${piece.id}`}
          className="text-sm font-medium text-foreground hover:text-primary line-clamp-2 transition-colors duration-100"
        >
          {piece.title}
        </Link>
        <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-sm ${statusConfig?.color}`}>
          {statusConfig?.label}
        </span>
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        {platforms.map((p) => {
          const config = PLATFORM_CONFIG[p];
          return config ? (
            <span
              key={p}
              className={`text-xs px-1.5 py-0.5 rounded-sm ${config.badgeColor}`}
            >
              {config.label}
            </span>
          ) : null;
        })}
      </div>

      {/* Review status indicators */}
      {hasReviewLink && (
        <div className="flex items-center gap-2 mb-2 text-xs">
          {lastAction ? (
            lastAction.action === "approved" ? (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="w-3 h-3" />
                {lastAction.authorName} 已批准
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertCircle className="w-3 h-3" />
                {lastAction.authorName} 请求修改
              </span>
            )
          ) : (
            <span className="flex items-center gap-1 text-muted-foreground">
              <LinkIcon className="w-3 h-3" />
              审阅链接已发送
              {piece._count.reviewComments > 0 && (
                <span className="flex items-center gap-0.5 ml-1">
                  <MessageSquare className="w-3 h-3" />
                  {piece._count.reviewComments}
                </span>
              )}
            </span>
          )}
        </div>
      )}

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
        {STATUS_COLUMNS.filter((s) => s.key !== piece.status).map((s) => (
          <button
            key={s.key}
            onClick={() => onStatusChange(piece.id, s.key)}
            className="text-xs px-1.5 py-0.5 rounded-md border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors duration-100"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
