"use client";

import { useState, useEffect, useCallback } from "react";
import type { ContentStatus } from "@/types";
import { STATUS_COLUMNS } from "@/types";
import { KanbanCard } from "./kanban-card";

interface ReviewAction {
  action: string;
  authorName: string;
  comment?: string;
  createdAt: string;
}

type BoardPiece = {
  id: string;
  title: string;
  type: string;
  brief: string;
  status: string;
  reviewToken: string | null;
  reviewExpiresAt: string | null;
  platformContents: { platform: string }[];
  _count: { reviewComments: number };
  _lastReviewAction: ReviewAction | null;
  createdAt: string;
  updatedAt: string;
};

export function KanbanBoard({ projectId }: { projectId?: string | null }) {
  const [pieces, setPieces] = useState<BoardPiece[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPieces = useCallback(async () => {
    const url = projectId ? `/api/briefs?projectId=${projectId}` : "/api/briefs";
    const r = await fetch(url);
    if (r.ok) {
      const all = await r.json();
      setPieces(all);
    }
  }, [projectId]);

  useEffect(() => {
    fetchPieces().then(() => setLoading(false));
  }, [fetchPieces]);

  // Poll every 30 seconds for review updates
  useEffect(() => {
    const interval = setInterval(fetchPieces, 30000);
    return () => clearInterval(interval);
  }, [fetchPieces]);

  const handleStatusChange = async (id: string, status: ContentStatus) => {
    const res = await fetch(`/api/content/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setPieces((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status } : p))
      );
    }
  };

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="h-full min-w-0 overflow-y-auto">
      <div className="grid content-start gap-4 p-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {STATUS_COLUMNS.map((col) => {
        const items = pieces.filter((p) => p.status === col.key);
        return (
          <section
            key={col.key}
            className="min-w-0 self-start rounded-xl border border-border/70 bg-muted/20 p-3"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="truncate text-sm font-medium text-foreground/70">{col.label}</h2>
              <span className="shrink-0 text-xs text-muted-foreground">{items.length}</span>
            </div>
            <div className="min-h-[140px] space-y-2">
              {items.map((piece) => (
                <KanbanCard
                  key={piece.id}
                  piece={piece}
                  onStatusChange={handleStatusChange}
                  showProject={!projectId}
                />
              ))}
              {items.length === 0 && (
                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center text-xs text-muted-foreground">
                  暂无内容
                </div>
              )}
            </div>
          </section>
        );
        })}
      </div>
    </div>
  );
}
