"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronUp, Sparkles, Search, Wand2, Check, X, RotateCw } from "lucide-react";
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

type TabType = "quality" | "seo";

export function OptimizationPanel({
  contentPieceId,
  content,
  platform = "wechat",
  onContentUpdate,
}: OptimizationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("quality");

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
      }
    }
  };

  const handleDiscardOptimization = () => {
    setOptimization(null);
  };

  const getQualityScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600";
    if (score >= 6) return "text-amber-600";
    return "text-red-600";
  };

  const getSEOScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  };

  const averageScore = quality
    ? Math.round((quality.quality + quality.engagement + quality.brandVoice + quality.platformFit) / 4)
    : null;

  const suggestions = quality ? JSON.parse(quality.suggestions || "[]") : [];

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Header - Always visible summary */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-4">
          <Wand2 className="w-5 h-5 text-purple-600" />
          <span className="font-medium">AI 内容优化</span>

          {/* Quick score badges */}
          <div className="flex items-center gap-2">
            {averageScore !== null && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-secondary rounded-full">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span className={`text-sm font-semibold ${getQualityScoreColor(averageScore)}`}>
                  {averageScore}
                </span>
              </div>
            )}
            {seoAnalysis && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-secondary rounded-full">
                <Search className="w-3.5 h-3.5 text-blue-600" />
                <span className={`text-sm font-semibold ${getSEOScoreColor(seoAnalysis.overallScore)}`}>
                  {seoAnalysis.overallScore}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isOpen && optimization && (
            <span className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
              待应用
            </span>
          )}
          {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-border">
          {/* Tab Navigation */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab("quality")}
              className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "quality"
                  ? "border-purple-600 text-purple-600 bg-purple-50/50"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="w-4 h-4 mr-1.5 inline" />
              内容质量
            </button>
            <button
              onClick={() => setActiveTab("seo")}
              className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "seo"
                  ? "border-blue-600 text-blue-600 bg-blue-50/50"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Search className="w-4 h-4 mr-1.5 inline" />
              SEO 分析
            </button>
          </div>

          {/* Tab Content */}
          <div className="px-4 py-4">
            {/* Quality Tab */}
            {activeTab === "quality" && (
              <div className="space-y-4">
                {qualityLoading ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">加载中...</div>
                ) : !quality ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground mb-4">尚未进行质量评估</p>
                    <Button onClick={handleEvaluate} disabled={evaluating} size="sm">
                      {evaluating ? "评估中..." : "开始评估"}
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Score Cards */}
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      <ScoreCard
                        label="内容质量"
                        score={quality.quality}
                        getColor={getQualityScoreColor}
                        icon="✨"
                      />
                      <ScoreCard
                        label="吸引力"
                        score={quality.engagement}
                        getColor={getQualityScoreColor}
                        icon="🎯"
                      />
                      <ScoreCard
                        label="品牌调性"
                        score={quality.brandVoice}
                        getColor={getQualityScoreColor}
                        icon="🎨"
                      />
                      <ScoreCard
                        label="平台适配"
                        score={quality.platformFit}
                        getColor={getQualityScoreColor}
                        icon="📱"
                      />
                    </div>

                    {/* Suggestions */}
                    {suggestions.length > 0 && (
                      <div className="bg-secondary/50 rounded-lg p-3">
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <span>💡</span> 优化建议
                        </h4>
                        <ul className="space-y-1.5">
                          {suggestions.map((s: string, i: number) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="text-purple-600 mt-0.5">•</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Action Button */}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <Button
                        onClick={() => handleOptimize("quality")}
                        disabled={optimizingType !== null || !content}
                        className="flex items-center gap-2"
                      >
                        <Wand2 className="w-4 h-4" />
                        {optimizingType === "quality" ? "优化中..." : "质量优化"}
                      </Button>
                      <Button
                        onClick={handleEvaluate}
                        disabled={evaluating}
                        size="sm"
                        variant="outline"
                      >
                        <RotateCw className="w-4 h-4 mr-1" />
                        重新评估
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* SEO Tab */}
            {activeTab === "seo" && (
              <div className="space-y-4">
                {/* Keyword Input */}
                <div>
                  <label className="block text-sm font-medium mb-2">目标关键词</label>
                  <Input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="输入要优化的关键词..."
                    className="w-full"
                  />
                </div>

                {/* SEO Metrics */}
                {seoAnalysis && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <MetricCard
                        label="字符数"
                        value={seoAnalysis.characterCount}
                        target="300-2000"
                        isGood={seoAnalysis.characterCount >= 300 && seoAnalysis.characterCount <= 2000}
                      />
                      <MetricCard
                        label="词数"
                        value={seoAnalysis.wordCount}
                        target="≥50"
                        isGood={seoAnalysis.wordCount >= 50}
                      />
                      {seoAnalysis.keywordDensity.length > 0 && (
                        <div className="bg-secondary/30 rounded-lg p-3">
                          <div className="text-xs text-muted-foreground mb-1">关键词密度</div>
                          <div className="flex items-end justify-between">
                            <span className={`text-2xl font-bold ${
                              seoAnalysis.keywordDensity[0].rating === "good" ? "text-green-600" :
                              seoAnalysis.keywordDensity[0].rating === "low" ? "text-amber-600" :
                              "text-red-600"
                            }`}>
                              {seoAnalysis.keywordDensity[0].density.toFixed(1)}%
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              seoAnalysis.keywordDensity[0].rating === "good" ? "bg-green-100 text-green-700" :
                              seoAnalysis.keywordDensity[0].rating === "low" ? "bg-amber-100 text-amber-700" :
                              "bg-red-100 text-red-700"
                            }`}>
                              {seoAnalysis.keywordDensity[0].rating === "good" ? "合适" :
                               seoAnalysis.keywordDensity[0].rating === "low" ? "偏低" : "过高"}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            出现 {seoAnalysis.keywordDensity[0].count} 次 · 建议 2-5%
                          </div>
                        </div>
                      )}
                    </div>

                    {/* SEO Issues - Show what needs to be fixed */}
                    {seoAnalysis && (
                      <div className="bg-secondary/50 rounded-lg p-3">
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <span>🔍</span> 检测到的问题
                        </h4>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {seoAnalysis.characterCount < 300 && (
                            <li className="flex items-start gap-2">
                              <span className="text-amber-600">⚠</span>
                              <span>内容过短 ({seoAnalysis.characterCount}/300)，需要扩展内容</span>
                            </li>
                          )}
                          {seoAnalysis.characterCount > 2000 && (
                            <li className="flex items-start gap-2">
                              <span className="text-amber-600">⚠</span>
                              <span>内容过长 ({seoAnalysis.characterCount}/2000)，需要精简</span>
                            </li>
                          )}
                          {seoAnalysis.wordCount < 50 && (
                            <li className="flex items-start gap-2">
                              <span className="text-amber-600">⚠</span>
                              <span>词数过少 ({seoAnalysis.wordCount}/50)，内容深度不足</span>
                            </li>
                          )}
                          {seoAnalysis.keywordDensity.length > 0 && seoAnalysis.keywordDensity[0].rating === "low" && (
                            <li className="flex items-start gap-2">
                              <span className="text-amber-600">⚠</span>
                              <span>关键词密度偏低 ({seoAnalysis.keywordDensity[0].density.toFixed(1)}%/2%)，需要增加关键词出现</span>
                            </li>
                          )}
                          {seoAnalysis.keywordDensity.length > 0 && seoAnalysis.keywordDensity[0].rating === "stuffed" && (
                            <li className="flex items-start gap-2">
                              <span className="text-red-600">⛔</span>
                              <span>关键词密度过高 ({seoAnalysis.keywordDensity[0].density.toFixed(1)}%/5%)，存在关键词堆砌</span>
                            </li>
                          )}
                          {seoAnalysis.keywordDensity.length > 0 && seoAnalysis.keywordDensity[0].rating === "good" && seoAnalysis.characterCount >= 300 && seoAnalysis.characterCount <= 2000 && seoAnalysis.wordCount >= 50 && (
                            <li className="flex items-start gap-2">
                              <span className="text-green-600">✓</span>
                              <span>SEO 指标良好，可以进行微调优化</span>
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* SEO Tips */}
                <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <span>📈</span> SEO 优化建议
                  </h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• 关键词密度保持在 2-5% 效果最佳</li>
                    <li>• 在标题和开头自然出现关键词</li>
                    <li>• 内容长度建议 300-2000 字符</li>
                  </ul>
                </div>

                {/* Action Button */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <Button
                    onClick={() => handleOptimize("seo")}
                    disabled={optimizingType !== null || !content || !keyword}
                    className="flex items-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    {optimizingType === "seo" ? "优化中..." : "SEO 优化"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Optimization Result - Fixed at bottom */}
          {optimization && (
            <div className="mt-4 pt-4 border-t border-border bg-gradient-to-r from-purple-50/50 to-blue-50/50 -mx-4 px-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {optimization.type === "quality" ? (
                    <>
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span className="font-medium text-sm">质量优化结果</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-sm">SEO 优化结果</span>
                    </>
                  )}
                </div>

                {!optimization.applied && (
                  <div className="flex gap-2">
                    <Button onClick={handleApplyOptimization} size="sm" className="h-7">
                      <Check className="w-3.5 h-3.5 mr-1" />
                      应用
                    </Button>
                    <Button onClick={handleDiscardOptimization} size="sm" variant="outline" className="h-7">
                      <X className="w-3.5 h-3.5 mr-1" />
                      放弃
                    </Button>
                  </div>
                )}

                {optimization.applied && (
                  <div className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                    <Check className="w-4 h-4" />
                    已应用到编辑器
                  </div>
                )}
              </div>

              {optimization.diff && (
                <div className="space-y-3">
                  {/* Summary */}
                  <div className="bg-white border border-border rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-2">优化预览</div>
                    <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono">
                      {optimization.diff}
                    </pre>
                  </div>

                  {/* Original vs Optimized toggle */}
                  <details className="bg-white border border-border rounded-lg overflow-hidden">
                    <summary className="px-3 py-2 text-sm font-medium cursor-pointer hover:bg-secondary/50">
                      查看完整对比 ▼
                    </summary>
                    <div className="p-3 border-t border-border space-y-2">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">原始内容</div>
                        <div className="text-xs bg-red-50 p-2 rounded border border-red-100 whitespace-pre-wrap">
                          {optimization.original.slice(0, 300)}
                          {optimization.original.length > 300 ? '...' : ''}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">优化后内容</div>
                        <div className="text-xs bg-green-50 p-2 rounded border border-green-100 whitespace-pre-wrap">
                          {optimization.optimized.slice(0, 300)}
                          {optimization.optimized.length > 300 ? '...' : ''}
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              )}
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
  getColor: (score: number) => string;
  icon: string;
}

function ScoreCard({ label, score, getColor, icon }: ScoreCardProps) {
  return (
    <div className="bg-secondary/30 rounded-lg p-3 text-center">
      <div className="text-lg mb-1">{icon}</div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-2xl font-bold ${getColor(score)}`}>{score}</div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: number;
  target: string;
  isGood: boolean;
}

function MetricCard({ label, value, target, isGood }: MetricCardProps) {
  return (
    <div className={`bg-secondary/30 rounded-lg p-3 ${isGood ? '' : 'border border-amber-200'}`}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-2xl font-bold ${isGood ? 'text-foreground' : 'text-amber-600'}`}>
        {value}
      </div>
      <div className={`text-xs mt-1 ${isGood ? 'text-green-600' : 'text-amber-600'}`}>
        目标: {target}
      </div>
    </div>
  );
}
