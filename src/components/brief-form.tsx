"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { Platform, Brief, BrandVoice } from "@/types";
import { PLATFORM_CONFIG } from "@/types";

const ALL_PLATFORMS: Platform[] = ["wechat", "weibo", "xiaohongshu", "douyin"];

export function BriefForm({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromOnboarding = searchParams?.get("onboarding") === "true";
  const [submitting, setSubmitting] = useState(false);
  const [topic, setTopic] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>(["wechat", "weibo"]);
  const [notes, setNotes] = useState("");
  const [references, setReferences] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || "");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [brandVoices, setBrandVoices] = useState<BrandVoice[]>([]);
  const [selectedBrandVoiceId, setSelectedBrandVoiceId] = useState("");
  const [loadingProjects, setLoadingProjects] = useState(!projectId);

  useEffect(() => {
    if (!projectId) {
      fetch("/api/projects")
        .then((r) => r.json())
        .then((data) => {
          setProjects(data);
          if (data.length > 0 && !selectedProjectId) {
            setSelectedProjectId(data[0].id);
          }
        })
        .finally(() => setLoadingProjects(false));
    }
  }, [projectId, selectedProjectId]);

  useEffect(() => {
    fetch("/api/brand-voices")
      .then((r) => r.json())
      .then((data) => setBrandVoices(data));
  }, []);

  const togglePlatform = (p: Platform) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (platforms.length === 0) return;

    const effectiveProjectId = projectId || selectedProjectId;
    if (!effectiveProjectId) return;

    setSubmitting(true);

    const brief: Brief = {
      topic,
      keyPoints: keyPoints.split("\n").filter(Boolean),
      platforms,
      notes,
      references,
      brandVoiceId: selectedBrandVoiceId || undefined,
    };

    const res = await fetch("/api/briefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...brief, projectId: effectiveProjectId }),
    });

    if (res.ok) {
      const result = await res.json();

      // Save onboarding progress if coming from onboarding
      if (fromOnboarding) {
        await fetch("/api/user/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step: "brief" }),
        });
        router.push("/onboarding");
      } else {
        router.push(`/content/${result.id}`);
      }
    } else {
      const data = await res.json();
      // Handle structured error format: { error: { type, code, message, param, doc_url } }
      const errorMessage = data.error?.message || data.error || "创建失败，请检查输入";
      const errorCode = data.error?.code;
      const docUrl = data.error?.doc_url;

      toast.error(errorMessage, {
        description: errorCode ? `错误代码: ${errorCode}` : undefined,
        action: docUrl ? {
          label: "查看文档",
          onClick: () => window.open(docUrl, "_blank"),
        } : undefined,
      });
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {/* Project selector — shown only when no projectId prop */}
      {!projectId && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">目标项目 *</label>
          {loadingProjects ? (
            <p className="text-sm text-muted-foreground">加载项目中...</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              请先<a href="/projects/new" className="text-primary hover:underline">创建一个项目</a>
            </p>
          ) : (
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm focus:ring-2 focus:ring-ring focus:border-primary transition-colors duration-100 bg-card text-foreground"
              required
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">主题 *</label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="例如：2024 年企业数字化转型趋势"
          className="w-full px-3 py-2 border border-input rounded-md text-sm focus:ring-2 focus:ring-ring focus:border-primary transition-colors duration-100 bg-card text-foreground placeholder:text-muted-foreground"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">核心要点</label>
        <textarea
          value={keyPoints}
          onChange={(e) => setKeyPoints(e.target.value)}
          placeholder="每行一个要点，例如：&#10;数字化转型的重要性&#10;关键技术趋势&#10;企业实施建议"
          rows={4}
          className="w-full px-3 py-2 border border-input rounded-md text-sm focus:ring-2 focus:ring-ring focus:border-primary transition-colors duration-100 bg-card text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">目标平台 *</label>
        <div className="flex flex-wrap gap-2">
          {ALL_PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => togglePlatform(p)}
              className={`px-3 py-1.5 rounded-md text-sm border transition-colors duration-100 ${
                platforms.includes(p)
                  ? `${PLATFORM_CONFIG[p].badgeColor} border-transparent font-medium`
                  : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {PLATFORM_CONFIG[p].label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">品牌调性</label>
        <select
          value={selectedBrandVoiceId}
          onChange={(e) => setSelectedBrandVoiceId(e.target.value)}
          className="w-full px-3 py-2 border border-input rounded-md text-sm focus:ring-2 focus:ring-ring focus:border-primary transition-colors duration-100 bg-card text-foreground"
        >
          <option value="">不指定（使用项目默认）</option>
          {brandVoices.map((bv) => (
            <option key={bv.id} value={bv.id}>{bv.name}</option>
          ))}
        </select>
        {brandVoices.length === 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            暂无品牌调性，<a href="/settings/brand-voice" className="text-primary hover:underline">去创建</a>
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">参考资料</label>
        <textarea
          value={references}
          onChange={(e) => setReferences(e.target.value)}
          placeholder="URL 或参考文本"
          rows={2}
          className="w-full px-3 py-2 border border-input rounded-md text-sm focus:ring-2 focus:ring-ring focus:border-primary transition-colors duration-100 bg-card text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">补充说明</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="品牌调性、特殊要求等"
          className="w-full px-3 py-2 border border-input rounded-md text-sm focus:ring-2 focus:ring-ring focus:border-primary transition-colors duration-100 bg-card text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <button
        type="submit"
        disabled={submitting || platforms.length === 0 || (!projectId && !selectedProjectId)}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-100"
      >
        {submitting ? "AI 生成中..." : "生成内容"}
      </button>
    </form>
  );
}
