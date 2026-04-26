"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ContentQuality } from "@/types";

interface QualityPanelProps {
  contentPieceId: string;
}

export function QualityPanel({ contentPieceId }: QualityPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [quality, setQuality] = useState<ContentQuality | null>(null);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  useEffect(() => {
    if (isOpen && !quality) {
      fetchQuality();
    }
  }, [isOpen, quality]);

  const fetchQuality = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/content/${contentPieceId}/quality`);
      if (res.ok) {
        const data = await res.json();
        setQuality(data);
      } else if (res.status === 404) {
        // No evaluation exists yet
        setQuality(null);
      } else {
        const data = await res.json();
        toast.error(data.error || "加载质量评估失败");
      }
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = async () => {
    setEvaluating(true);
    try {
      const res = await fetch(`/api/content/${contentPieceId}/quality`, {
        method: "POST",
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
              <div className="flex justify-end pt-2 border-t border-border">
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
