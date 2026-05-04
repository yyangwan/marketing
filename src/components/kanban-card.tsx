import Link from "next/link";
import type { ContentStatus, Platform } from "@/types";
import { STATUS_COLUMNS, PLATFORM_CONFIG } from "@/types";
import { Link as LinkIcon, MessageSquare, CheckCircle, AlertCircle } from "lucide-react";
import { normalizeContentStatus } from "@/lib/content-status";
import { getNextStatusActions } from "@/lib/content-workflow";

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
  const currentStatus = normalizeContentStatus(piece.status) ?? "draft";
  const statusConfig = STATUS_COLUMNS.find((s) => s.key === currentStatus);
  const nextStatusActions = getNextStatusActions(currentStatus);
  const hasReviewLink = !!piece.reviewToken;
  const lastAction = piece._lastReviewAction;

  return (
    <div className="group rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow duration-100 hover:shadow-md">
      {showProject && piece.project?.name && (
        <p className="mb-1 truncate text-xs text-secondary">{piece.project.name}</p>
      )}
      <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
        <Link
          href={`/content/${piece.id}`}
          className="min-w-0 flex-1 text-sm font-medium text-foreground transition-colors duration-100 hover:text-primary line-clamp-2"
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
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
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

      {nextStatusActions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/70 pt-3 opacity-100 transition-opacity duration-100 sm:opacity-0 sm:group-hover:opacity-100">
          {nextStatusActions.map((status) => {
            const option = STATUS_COLUMNS.find((s) => s.key === status);
            if (!option) {
              return null;
            }

            return (
              <button
                key={option.key}
                onClick={() => onStatusChange(piece.id, option.key)}
                className="min-w-0 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors duration-100 hover:bg-secondary hover:text-foreground"
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
