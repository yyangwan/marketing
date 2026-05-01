"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronUp, Sparkles, Wand2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { ContentQuality } from "@/types";

interface OptimizationPanelProps {
  contentPieceId: string;
  content: string;
  platform?: string;
  onContentUpdate?: (newContent: string) => Promise<boolean>;
}

interface OptimizationResult {
  type: "quality" | "seo";
  original: string;
  optimized: string;
  diff: string;
  applied: boolean;
}

interface SEOAnalysis {
  characterCount: number;
  wordCount: number;
  keywordDensity: {
    keyword: string;
    count: number;
    density: number;
    rating: "good" | "low" | "stuffed";
  }[];
  overallScore: number;
}

export function OptimizationPanel({
  contentPieceId,
  content,
  platform = "wechat",
  onContentUpdate,
}: OptimizationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Quality state
  const [quality, setQuality] = useState<ContentQuality | null>(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  // SEO state
  const [keyword, setKeyword] = useState("");
  const [seoAnalysis, setSeoAnalysis] = useState<SEOAnalysis | null>(null);

  // Optimization state
  const [optimizingType, setOptimizingType] = useState<"quality" | "seo" | null>(null);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);

  // Calculate SEO analysis
  const calculatedSEO = useMemo(() => {
    if (!content) return null;

    const textContent = content.replace(/<[^>]*>/g, "");
    const characterCount = textContent.length;
    const words = textContent.split(/\s+/).filter((w) => w.length > 0);
    const wordCount = words.length;

    let keywordDensity: SEOAnalysis["keywordDensity"] = [];
    if (keyword.trim()) {
      const keywordLower = keyword.toLowerCase();
      const regex = new RegExp(keywordLower, "gi");
      const matches = (textContent.match(regex) || []).length;
      const density = wordCount > 0 ? (matches / wordCount) * 100 : 0;

      let rating: "good" | "low" | "stuffed" = "good";
      if (density < 2) rating = "low";
      else if (density > 5) rating = "stuffed";

      keywordDensity = [{ keyword, count: matches, density, rating }];
    }

    let score = 0;
    if (characterCount > 0) score += 20;
    if (characterCount >= 300) score += 20;
    if (wordCount >= 50) score += 20;
    if (keywordDensity.length > 0) {
      const kd = keywordDensity[0];
      if (kd.rating === "good") score += 40;
      else if (kd.rating === "low") score += 20;
      else score += 10;
    } else {
      score += 30;
    }

    return { characterCount, wordCount, keywordDensity, overallScore: score };
  }, [content, keyword]);

  useEffect(() => {
    setSeoAnalysis(calculatedSEO);
  }, [calculatedSEO]);

  useEffect(() => {
    if (isOpen && !quality) {
      fetchQuality();
    }
  }, [isOpen, quality]);

  const fetchQuality = async () => {
    setQualityLoading(true);
    try {
      const res = await fetch(`/api/content/${contentPieceId}/quality`);
      if (res.ok) {
        const data = await res.json();
        setQuality(data);
      } else if (res.status === 404) {
        setQuality(null);
      }
    } catch {
      // Ignore
    } finally {
      setQualityLoading(false);
    }
  };

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

  const handleOptimize = async (type: "quality" | "seo") => {
    setOptimizingType(type);
    try {
      const endpoint = type === "quality"
        ? `/api/content/${contentPieceId}/optimize`
        : `/api/content/${contentPieceId}/optimize-seo`;

      const body = type === "quality"
        ? { platform, content }
        : { content, keyword };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setOptimization({ ...data, type });
        toast.success(`${type === "quality" ? "内容质量" : "SEO"}优化已完成`);
      } else {
        const data = await res.json();
        toast.error(data.error || "优化失败");
      }
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setOptimizingType(null);
    }
  };

  const handleApplyOptimization = async () => {
    if (optimization && onContentUpdate) {
      const success = await onContentUpdate(optimization.optimized);
      if (success) {
        setOptimization({ ...optimization, applied: true });

        // Re-evaluate after applying
        if (optimization.type === "quality") {
          await handleEvaluate();
        }
        toast.success("优化内容已应用");
      }
    }
  };

  const handleDiscardOptimization = () => {
    setOptimization(null);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  };

  const getQualityScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600";
    if (score >= 6) return "text-amber-600";
    return "text-red-600";
  };

  const getQualityScoreLabel = (score: number) => {
    if (score >= 9) return "优秀";
    if (score >= 7) return "良好";
    if (score >= 5) return "一般";
    return "需改进";
  };

  const averageScore =
    quality &&
    Math.round(
      (quality.quality + quality.engagement + quality.brandVoice + quality.platformFit) / 4
    );

  const suggestions = quality ? JSON.parse(quality.suggestions || "[]") : [];

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex justify-between items-center hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span className="font-medium">内容优化</span>
          {quality && averageScore !== null && (
            <span className={`text-sm font-bold px-2 py-0.5 rounded ${getQualityScoreColor(averageScore)} bg-secondary`}>
              {averageScore}/10
            </span>
          )}
          {seoAnalysis && (
            <span className={`text-sm font-bold px-2 py-0.5 rounded ${getScoreColor(seoAnalysis.overallScore)} bg-secondary`}>
              SEO {seoAnalysis.overallScore}/100
            </span>
          )}
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {isOpen && (
        <div className="border-t border-border">
          {/* Quality Scores */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h3 className="font-medium text-sm">内容质量评估</h3>
            </div>

            {qualityLoading ? (
              <p className="text-sm text-muted-foreground py-2">加载中...</p>
            ) : !quality ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">尚未进行质量评估</p>
                <Button onClick={handleEvaluate} disabled={evaluating} size="sm">
                  {evaluating ? "评估中..." : "开始评估"}
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <MiniScoreCard label="质量" score={quality.quality} getColor={getQualityScoreColor} />
                  <MiniScoreCard label="吸引力" score={quality.engagement} getColor={getQualityScoreColor} />
                  <MiniScoreCard label="调性" score={quality.brandVoice} getColor={getQualityScoreColor} />
                  <MiniScoreCard label="适配" score={quality.platformFit} getColor={getQualityScoreColor} />
                </div>
                {suggestions.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {suggestions.slice(0, 2).join("； ")}
                  </div>
                )}
              </>
            )}
          </div>

          {/* SEO Analysis */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-4 h-4 text-blue-600" />
              <h3 className="font-medium text-sm">SEO 分析</h3>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="输入目标关键词..."
                className="flex-1 h-8 text-sm"
              />
            </div>

            {seoAnalysis && (
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="text-center">
                  <div className="text-muted-foreground">字符数</div>
                  <div className="font-medium">{seoAnalysis.characterCount}</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground">词数</div>
                  <div className="font-medium">{seoAnalysis.wordCount}</div>
                </div>
                {seoAnalysis.keywordDensity.length > 0 && (
                  <div className="text-center">
                    <div className="text-muted-foreground">关键词密度</div>
                    <div className={`font-medium ${
                      seoAnalysis.keywordDensity[0].rating === "good" ? "text-green-600" :
                      seoAnalysis.keywordDensity[0].rating === "low" ? "text-amber-600" :
                      "text-red-600"
                    }`}>
                      {seoAnalysis.keywordDensity[0].density.toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="px-4 py-3 bg-secondary/30 flex gap-2">
            <Button
              onClick={() => handleOptimize("quality")}
              disabled={optimizingType !== null || !content}
              size="sm"
              variant={optimization?.type === "quality" ? "default" : "outline"}
              className="flex-1 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {optimizingType === "quality" ? "优化中..." : "质量优化"}
            </Button>
            <Button
              onClick={() => handleOptimize("seo")}
              disabled={optimizingType !== null || !content || !keyword}
              size="sm"
              variant={optimization?.type === "seo" ? "default" : "outline"}
              className="flex-1 flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              {optimizingType === "seo" ? "优化中..." : "SEO 优化"}
            </Button>
            <Button
              onClick={handleEvaluate}
              disabled={evaluating}
              size="sm"
              variant="ghost"
            >
              重新评估
            </Button>
          </div>

          {/* Optimization Result */}
          {optimization && (
            <div className="px-4 py-3 border-t border-border bg-secondary/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  {optimization.type === "quality" ? (
                    <Sparkles className="w-4 h-4 text-purple-600" />
                  ) : (
                    <Search className="w-4 h-4 text-blue-600" />
                  )}
                  {optimization.type === "quality" ? "质量优化" : "SEO 优化"}结果
                </span>
                {!optimization.applied && (
                  <div className="flex gap-2">
                    <Button onClick={handleApplyOptimization} size="sm">
                      应用
                    </Button>
                    <Button onClick={handleDiscardOptimization} size="sm" variant="outline">
                      放弃
                    </Button>
                  </div>
                )}
              </div>

              {optimization.applied && (
                <div className="text-sm text-green-600 mb-2">✓ 已应用</div>
              )}

              {optimization.diff && (
                <pre className="text-xs bg-background border border-border rounded p-2 overflow-auto max-h-32 whitespace-pre-wrap font-mono">
                  {optimization.diff}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface MiniScoreCardProps {
  label: string;
  score: number;
  getColor: (score: number) => string;
}

function MiniScoreCard({ label, score, getColor }: MiniScoreCardProps) {
  return (
    <div className="text-center p-2 bg-secondary/30 rounded">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${getColor(score)}`}>{score}</div>
    </div>
  );
}
