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
    <div className="flex gap-4 p-4 h-full overflow-x-auto">
      {STATUS_COLUMNS.map((col) => {
        const items = pieces.filter((p) => p.status === col.key);
        return (
          <div key={col.key} className="flex-1 min-w-[220px]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-foreground/70">{col.label}</h2>
              <span className="text-xs text-muted-foreground">{items.length}</span>
            </div>
            <div className="space-y-2 min-h-[200px]">
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
          </div>
        );
      })}
    </div>
  );
}
