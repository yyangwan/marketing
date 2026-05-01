"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extension-placeholder";
import { useState, useEffect } from "react";
import type { Platform } from "@/types";
import { PLATFORM_CONFIG } from "@/types";
import { toast } from "sonner";
import { Link, Copy, Send, Calendar, X } from "lucide-react";
import { OptimizationPanel } from "@/components/optimization-panel";

interface EditorProps {
  platforms: { platform: string; content: string; id: string; status: string }[];
  contentPieceId: string;
  initialReviewUrl?: string | null;
}

export function ContentEditor({ platforms, contentPieceId, initialReviewUrl }: EditorProps) {
  const [activeTab, setActiveTab] = useState<Platform>(
    (platforms[0]?.platform as Platform) || "wechat"
  );
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [publishedPlatforms, setPublishedPlatforms] = useState<Set<string>>(
    new Set(platforms.filter((p) => p.status === "published").map((p) => p.platform))
  );
  const [reviewUrl, setReviewUrl] = useState<string | null>(initialReviewUrl || null);
  const [generatingLink, setGeneratingLink] = useState(false);

  // Schedule dialog state
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [currentSchedule, setCurrentSchedule] = useState<any>(null);

  const activeContent = platforms.find((p) => p.platform === activeTab);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "AI 生成的内容将显示在这里..." }),
    ],
    content: activeContent?.content || "",
    immediatelyRender: false,
  });

  // Update editor content when switching platforms
  useEffect(() => {
    if (editor && activeContent?.content !== undefined) {
      editor.commands.setContent(activeContent.content, { emitUpdate: false });
    }
  }, [activeTab, activeContent, editor]);

  // Fetch existing schedule on mount
  useEffect(() => {
    fetchSchedule();
  }, [contentPieceId]);

  const fetchSchedule = async () => {
    try {
      const res = await fetch(`/api/content/${contentPieceId}/schedule`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setCurrentSchedule(data);
          const date = new Date(data.scheduledAt);
          setScheduleDate(date.toISOString().split('T')[0]);
          setScheduleTime(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
        }
      }
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleDate || !scheduleTime) {
      toast.error("请选择日期和时间");
      return;
    }

    setScheduling(true);
    try {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
      const res = await fetch(`/api/content/${contentPieceId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: scheduledAt.toISOString() }),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentSchedule(data);
        setShowScheduleDialog(false);
        toast.success("日程已安排", {
          description: `发布时间: ${scheduledAt.toLocaleString('zh-CN')}`,
        });
      } else {
        const err = await res.json();
        toast.error(`安排失败: ${err.error}`);
      }
    } catch (error) {
      toast.error("安排失败，请重试");
    } finally {
      setScheduling(false);
    }
  };

  const handleRemoveSchedule = async () => {
    if (!confirm("确定要取消日程安排吗？")) return;

    try {
      const res = await fetch(`/api/content/${contentPieceId}/schedule`, {
        method: "DELETE",
      });

      if (res.ok) {
        setCurrentSchedule(null);
        toast.success("日程已取消");
      } else {
        toast.error("取消失败");
      }
    } catch (error) {
      toast.error("取消失败，请重试");
    }
  };

  const handleContentUpdate = async (newContent: string) => {
    if (editor) {
      // Update editor content
      editor.commands.setContent(newContent, { emitUpdate: false });
      editor.view.focus();

      // Auto-save after applying optimization
      setSaving(true);
      try {
        const res = await fetch(`/api/content/${contentPieceId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platformContent: {
              platform: activeTab,
              content: newContent,
            },
          }),
        });
        if (res.ok) {
          return true;
        } else {
          toast.error("保存失败，请手动保存");
          return false;
        }
      } catch {
        toast.error("保存失败，请手动保存");
        return false;
      } finally {
        setSaving(false);
      }
    }
    return false;
  };

  const handleQualityUpdate = () => {
    // Refresh quality panel by re-fetching
    fetchQuality();
  };

  const fetchQuality = async () => {
    try {
      const res = await fetch(`/api/content/${contentPieceId}/quality`);
      if (res.ok) {
        // Quality panel will fetch on its own when opened
        // This is just a trigger for potential other updates
      }
    } catch {
      // Ignore
    }
  };

  const handleSave = async () => {
    if (!editor) return;
    setSaving(true);
    const res = await fetch(`/api/content/${contentPieceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platformContent: {
          platform: activeTab,
          content: editor.getHTML(),
        },
      }),
    });
    if (res.ok) {
      toast.success("内容已保存");
    } else {
      toast.error("保存失败");
    }
    setSaving(false);
  };

  const handlePublish = async (pcId: string) => {
    setPublishing(pcId);
    const label = PLATFORM_CONFIG[activeTab]?.label || activeTab;
    const res = await fetch(`/api/publish/${pcId}`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setPublishedPlatforms((prev) => new Set(prev).add(activeTab));
      toast.success(`已发布到${label}`, {
        description: data.publishedUrl,
      });
    } else {
      const err = await res.json();
      toast.error(`发布失败: ${err.error}`);
    }
    setPublishing(null);
  };

  const handleRegenerate = async () => {
    if (!editor) return;
    editor.commands.setContent("<p>重新生成中...</p>");
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentPieceId, platform: activeTab }),
    });
    if (res.ok) {
      const data = await res.json();
      editor.commands.setContent(data.content || "");
      toast.success("内容已重新生成");
    } else {
      toast.error("重新生成失败");
    }
  };

  const handleGenerateReviewLink = async () => {
    setGeneratingLink(true);
    const res = await fetch(`/api/content/${contentPieceId}/review-link`, {
      method: "POST",
    });
    if (res.ok) {
      const data = await res.json();
      const fullUrl = `${window.location.origin}${data.reviewUrl}`;
      setReviewUrl(fullUrl);
      toast.success("审阅链接已生成", { description: "已复制到剪贴板" });
      await navigator.clipboard.writeText(fullUrl);
    } else {
      toast.error("生成审阅链接失败");
    }
    setGeneratingLink(false);
  };

  const handleCopyLink = async () => {
    if (reviewUrl) {
      await navigator.clipboard.writeText(reviewUrl);
      toast.success("链接已复制");
    }
  };

  return (
    <div>
      {/* Platform tabs */}
      <div className="flex border-b border-border mb-4">
        {platforms.map((pc) => (
          <button
            key={pc.platform}
            onClick={() => {
              setActiveTab(pc.platform as Platform);
              editor?.commands.setContent(pc.content || "");
            }}
            className={`px-4 py-2 text-sm border-b-2 transition-colors duration-100 ${
              activeTab === pc.platform
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {PLATFORM_CONFIG[pc.platform as Platform]?.label || pc.platform}
            {publishedPlatforms.has(pc.platform) && (
              <span className="ml-1.5 text-green-600">✓</span>
            )}
          </button>
        ))}
      </div>

      {/* Editor area */}
      <div className="border border-border rounded-lg min-h-[400px] p-4 bg-card">
        <EditorContent editor={editor} className="prose prose-sm max-w-none" />
      </div>

      {/* Action bar */}
      <div className="flex gap-2 mt-4 flex-wrap">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 text-sm bg-secondary text-foreground rounded-md hover:bg-secondary/80 transition-colors duration-100 disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存"}
        </button>
        <button
          onClick={handleRegenerate}
          className="px-3 py-1.5 text-sm bg-amber-50 text-amber-700 rounded-md hover:bg-amber-100 transition-colors duration-100"
        >
          重新生成
        </button>

        {/* Schedule button */}
        {currentSchedule ? (
          <div className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-md">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {new Date(currentSchedule.scheduledAt).toLocaleString('zh-CN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <button
              onClick={handleRemoveSchedule}
              className="ml-1 text-blue-900 hover:text-blue-700"
              title="取消日程"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowScheduleDialog(true)}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-100 flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            安排日程
          </button>
        )}

        {activeContent && (
          <button
            onClick={() => handlePublish(activeContent.id)}
            disabled={publishing === activeContent.id || publishedPlatforms.has(activeTab)}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-100"
          >
            {publishing === activeContent.id
              ? "发布中..."
              : publishedPlatforms.has(activeTab)
                ? "已发布"
                : `发布到${PLATFORM_CONFIG[activeTab]?.label || activeTab}`}
          </button>
        )}

        {/* Review link section */}
        <div className="ml-auto flex items-center gap-2">
          {reviewUrl ? (
            <>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Link className="w-3 h-3" />
                审阅链接已生成
              </span>
              <button
                onClick={handleCopyLink}
                className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-secondary transition-colors duration-100 flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                复制链接
              </button>
              <button
                onClick={handleGenerateReviewLink}
                disabled={generatingLink}
                className="px-3 py-1.5 text-sm text-primary hover:underline disabled:opacity-50"
              >
                重新生成
              </button>
            </>
          ) : (
            <button
              onClick={handleGenerateReviewLink}
              disabled={generatingLink}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity duration-100 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {generatingLink ? "生成中..." : "发送审阅链接"}
            </button>
          )}
        </div>
      </div>

      {/* Optimization Panel */}
      <div className="mt-4">
        <OptimizationPanel
          contentPieceId={contentPieceId}
          content={editor?.getHTML() || ""}
          platform={activeTab}
          onContentUpdate={handleContentUpdate}
        />
      </div>

      {/* Schedule Dialog */}
      {showScheduleDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">安排发布日程</h3>
              <button
                onClick={() => setShowScheduleDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  发布日期
                </label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full border rounded-md px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  发布时间
                </label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => setShowScheduleDialog(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleSchedule}
                  disabled={scheduling || !scheduleDate || !scheduleTime}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {scheduling ? "安排中..." : "确认"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
