"use client";

import { useState } from "react";
import { toast } from "sonner";

interface PlatformData {
  platform: string;
  label: string;
  badgeColor: string;
  content: string;
}

interface ExistingAction {
  action: string;
  authorName: string;
  comment?: string;
  createdAt: string;
}

interface Props {
  title: string;
  platforms: PlatformData[];
  token: string;
  existingAction: ExistingAction | null;
}

export function ReviewPageClient({ title, platforms, token, existingAction }: Props) {
  const [activeTab, setActiveTab] = useState(platforms[0]?.platform || "");
  const [name, setName] = useState("");
  const [revisionComment, setRevisionComment] = useState("");
  const [showRevision, setShowRevision] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExistingAction | null>(existingAction);

  const activePlatform = platforms.find((p) => p.platform === activeTab);

  const handleApprove = async () => {
    if (!name.trim()) {
      toast.error("请输入您的姓名");
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/review/${token}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorName: name }),
    });
    if (res.ok) {
      setResult({ action: "approved", authorName: name, createdAt: new Date().toISOString() });
      toast.success("已批准");
    } else if (res.status === 409) {
      toast.error("此内容已被审阅");
      setResult({ action: "already_reviewed", authorName: "", createdAt: "" });
    } else {
      toast.error("操作失败，请重试");
    }
    setSubmitting(false);
  };

  const handleRevision = async () => {
    if (!name.trim()) {
      toast.error("请输入您的姓名");
      return;
    }
    if (!revisionComment.trim()) {
      toast.error("请填写修改意见");
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/review/${token}/revision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorName: name, comment: revisionComment }),
    });
    if (res.ok) {
      setResult({ action: "revision_requested", authorName: name, comment: revisionComment, createdAt: new Date().toISOString() });
      toast.success("修改意见已提交");
    } else if (res.status === 409) {
      toast.error("此内容已被审阅");
    } else {
      toast.error("操作失败，请重试");
    }
    setSubmitting(false);
  };

  // Already reviewed state
  if (result && result.action !== "already_reviewed") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          {result.action === "approved" ? (
            <>
              <div className="w-16 h-16 rounded-full bg-green-100 mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-lg font-semibold text-foreground mb-1">已批准</h1>
              <p className="text-sm text-muted-foreground">{result.authorName} 已批准此内容</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-amber-100 mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-lg font-semibold text-foreground mb-1">需要修改</h1>
              <p className="text-sm text-muted-foreground mb-3">{result.authorName} 请求修改</p>
              {result.comment && (
                <div className="bg-card border border-border rounded-lg p-3 text-left">
                  <p className="text-sm text-foreground">{result.comment}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3">
        <h1 className="text-base font-semibold text-foreground truncate">{title}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">内容审阅</p>
      </div>

      {/* Platform tabs */}
      <div className="flex border-b border-border bg-card px-4 overflow-x-auto">
        {platforms.map((p) => (
          <button
            key={p.platform}
            onClick={() => setActiveTab(p.platform)}
            className={`px-3 py-2.5 text-sm border-b-2 whitespace-nowrap transition-colors duration-100 ${
              activeTab === p.platform
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground"
            }`}
          >
            <span className={`inline-block px-1.5 py-0.5 rounded text-xs mr-1 ${p.badgeColor}`}>
              {p.label}
            </span>
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-40">
        {activePlatform && (
          <div className="bg-card border border-border rounded-lg p-4">
            {activePlatform.content.startsWith("<") ? (
              <div
                className="prose prose-sm max-w-none text-foreground"
                dangerouslySetInnerHTML={{ __html: activePlatform.content }}
              />
            ) : (
              <p className="text-sm text-foreground whitespace-pre-wrap">{activePlatform.content}</p>
            )}
          </div>
        )}
      </div>

      {/* Bottom action bar - fixed */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 safe-bottom">
        {/* Name input */}
        <div className="mb-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入您的姓名"
            className="w-full px-3 py-2.5 border border-input rounded-lg text-sm bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-primary"
          />
        </div>

        {!showRevision ? (
          <div className="flex gap-2">
            <button
              onClick={handleApprove}
              disabled={submitting || !name.trim()}
              className="flex-1 py-3 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors duration-100"
            >
              {submitting ? "提交中..." : "批准"}
            </button>
            <button
              onClick={() => setShowRevision(true)}
              disabled={submitting}
              className="flex-1 py-3 text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors duration-100"
            >
              需要修改
            </button>
          </div>
        ) : (
          <div>
            <textarea
              value={revisionComment}
              onChange={(e) => setRevisionComment(e.target.value)}
              placeholder="请填写修改意见..."
              rows={3}
              className="w-full px-3 py-2.5 border border-input rounded-lg text-sm bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-primary mb-2 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowRevision(false)}
                className="px-4 py-2.5 text-sm text-muted-foreground rounded-lg hover:bg-secondary transition-colors duration-100"
              >
                取消
              </button>
              <button
                onClick={handleRevision}
                disabled={submitting || !revisionComment.trim()}
                className="flex-1 py-2.5 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors duration-100"
              >
                {submitting ? "提交中..." : "提交修改意见"}
              </button>
            </div>
          </div>
        )}
      </div>

      <Toaster position="top-center" />
    </div>
  );
}

// Need Toaster in this component since layout doesn't include it for public pages
import { Toaster } from "sonner";
