"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ContentQuality } from "@/types";

interface QualityPanelProps {
  contentPieceId: string;
  content: string;
  platform?: string;
  onContentUpdate?: (newContent: string) => void;
  onQualityUpdate?: () => void;
}

interface OptimizationResult {
  original: string;
  optimized: string;
  diff: string;
  applied: boolean;
}

export function QualityPanel({
  contentPieceId,
  content,
  platform = "wechat",
  onContentUpdate,
  onQualityUpdate
}: QualityPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [quality, setQuality] = useState<ContentQuality | null>(null);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);

  useEffect(() => {
    if (isOpen && !quality) {
      let stale = false;
      const doFetch = async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/content/${contentPieceId}/quality`);
          if (res.ok && !stale) {
            const data = await res.json();
            setQuality(data);
          } else if (res.status === 404 && !stale) {
            setQuality(null);
          } else if (!stale) {
            const data = await res.json();
            toast.error(data.error || "加载质量评估失败");
          }
        } catch {
          if (!stale) toast.error("网络错误，请重试");
        } finally {
          if (!stale) setLoading(false);
        }
      };
      doFetch();
      return () => { stale = true; };
    }
  }, [isOpen, quality, contentPieceId]);

  const handleEvaluate = async () => {
    setEvaluating(true);
    try {
      const res = await fetch(`/api/content/${contentPieceId}/quality`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });

      if (res.ok) {
        const data = await res.json();
        setQuality(data);
        toast.success("质量评估已完成");
      } else {
        const data = await res.json();
        toast.error(data.error || "评估失败");
      }
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setEvaluating(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600";
    if (score >= 6) return "text-amber-600";
    return "text-red-600";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 9) return "优秀";
    if (score >= 7) return "良好";
    if (score >= 5) return "一般";
    return "需改进";
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      const res = await fetch(`/api/content/${contentPieceId}/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: platform,
          content: content,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setOptimization(data);
        toast.success("AI 优化已完成");
      } else {
        const data = await res.json();
        toast.error(data.error || "优化失败");
      }
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setOptimizing(false);
    }
  };

  const handleApplyOptimization = async () => {
    if (optimization && onContentUpdate) {
      await onContentUpdate(optimization.optimized);
      setOptimization({ ...optimization, applied: true });

      // Trigger re-evaluation after applying optimization
      setEvaluating(true);
      try {
        const res = await fetch(`/api/content/${contentPieceId}/quality`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform }),
        });
        if (res.ok) {
          const data = await res.json();
          setQuality(data);
          if (onQualityUpdate) {
            onQualityUpdate();
          }
          toast.success("优化内容已应用，质量评估已更新");
        } else {
          toast.warning("优化内容已应用，但质量评估更新失败");
        }
      } catch {
        toast.warning("优化内容已应用，但质量评估更新失败");
      } finally {
        setEvaluating(false);
      }
    }
  };

  const handleDiscardOptimization = () => {
    setOptimization(null);
  };

  const averageScore =
    quality &&
    Math.round(
      (quality.quality + quality.engagement + quality.brandVoice + quality.platformFit) /
        4
    );

  const suggestions = quality ? JSON.parse(quality.suggestions || "[]") : [];

  return (
    <div className="border border-border rounded-lg bg-card">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex justify-between items-center hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span className="font-medium">内容质量评估</span>
          {averageScore !== null && (
            <span className={`text-lg font-bold ${getScoreColor(averageScore)}`}>
              {averageScore}/10
            </span>
          )}
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {isOpen && (
        <div className="px-4 py-3 border-t border-border space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : !quality ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-3">
                尚未进行质量评估
              </p>
              <Button
                onClick={handleEvaluate}
                disabled={evaluating}
                className="mx-auto"
              >
                {evaluating ? "评估中..." : "开始评估"}
              </Button>
            </div>
          ) : (
            <>
              {/* Score grid */}
              <div className="grid grid-cols-2 gap-3">
                <ScoreCard
                  label="内容质量"
                  score={quality.quality}
                  getScoreColor={getScoreColor}
                  getScoreLabel={getScoreLabel}
                />
                <ScoreCard
                  label="吸引力"
                  score={quality.engagement}
                  getScoreColor={getScoreColor}
                  getScoreLabel={getScoreLabel}
                />
                <ScoreCard
                  label="品牌调性"
                  score={quality.brandVoice}
                  getScoreColor={getScoreColor}
                  getScoreLabel={getScoreLabel}
                />
                <ScoreCard
                  label="平台适配"
                  score={quality.platformFit}
                  getScoreColor={getScoreColor}
                  getScoreLabel={getScoreLabel}
                />
              </div>

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">优化建议</h4>
                  <ul className="space-y-2">
                    {suggestions.map((suggestion: string, index: number) => (
                      <li
                        key={index}
                        className="text-sm text-muted-foreground bg-secondary/50 p-2 rounded"
                      >
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Re-evaluate button */}
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <Button
                  onClick={handleOptimize}
                  disabled={optimizing || !content}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Wand2 className="w-4 h-4" />
                  {optimizing ? "优化中..." : "AI 一键优化"}
                </Button>
                <Button
                  onClick={handleEvaluate}
                  disabled={evaluating}
                  size="sm"
                  variant="outline"
                >
                  {evaluating ? "重新评估中..." : "重新评估"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Optimization Result */}
      {optimization && (
        <div className="px-4 py-3 border-t border-border bg-secondary/30">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              优化结果
            </h4>
            {!optimization.applied && (
              <div className="flex gap-2">
                <Button
                  onClick={handleApplyOptimization}
                  size="sm"
                >
                  应用优化
                </Button>
                <Button
                  onClick={handleDiscardOptimization}
                  size="sm"
                  variant="outline"
                >
                  放弃
                </Button>
              </div>
            )}
          </div>

          {optimization.applied && (
            <div className="text-sm text-green-600 flex items-center gap-2">
              ✓ 优化已应用到编辑器
            </div>
          )}

          {/* Diff Display */}
          {optimization.diff && (
            <div className="mt-3">
              <pre className="text-xs bg-background border border-border rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap font-mono">
                {optimization.diff}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ScoreCardProps {
  label: string;
  score: number;
  getScoreColor: (score: number) => string;
  getScoreLabel: (score: number) => string;
}

function ScoreCard({ label, score, getScoreColor, getScoreLabel }: ScoreCardProps) {
  return (
    <div className="border border-border rounded p-3 text-center">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-2xl font-bold ${getScoreColor(score)}`}>
        {score}
      </div>
      <div className={`text-xs ${getScoreColor(score)} mt-1`}>
        {getScoreLabel(score)}
      </div>
    </div>
  );
}
