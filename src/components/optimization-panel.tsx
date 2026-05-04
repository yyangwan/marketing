"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Lightbulb,
  RotateCw,
  Search,
  Sparkles,
  Target,
  Wand2,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ContentQuality, Platform } from "@/types";
import { analyzeForPlatform } from "@/lib/analysis/platform-analyzer";
import { getPlatformRules, type PlatformAnalysisResult } from "@/lib/analysis/platform-rules/base";

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
  keywordInTitle: boolean;
  keywordInOpening: boolean;
  hasH1: boolean;
  headingCount: number;
  validHierarchy: boolean;
}

interface LocalQualityAnalysis {
  localMetrics: {
    readabilityScore: number;
    vocabularyDiversity: number;
    sentenceComplexity: number;
    consistencyScore: number;
  };
  overallScore: number;
  sentiment: {
    overall: "positive" | "neutral" | "negative";
    score: number;
    confidence: number;
  };
  structure: {
    hasH1: boolean;
    h1Count: number;
    headingHierarchy: string[];
    paragraphCount: number;
    averageParagraphLength: number;
    longParagraphs: number;
    structureScore: number;
  };
  keywords: Array<{ keyword: string; frequency?: number; relevance?: number }>;
  suggestions: string[];
}

type TabType = "quality" | "seo";
type InsightTone = "success" | "warning" | "danger" | "info";

interface InsightItem {
  tone: InsightTone;
  text: string;
}

interface PlatformDimension {
  label: string;
  description: string;
  hint: string;
}

export function OptimizationPanel({
  contentPieceId,
  content,
  platform = "wechat",
  onContentUpdate,
}: OptimizationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("quality");

  const [localAnalysis, setLocalAnalysis] = useState<LocalQualityAnalysis | null>(null);
  const [localLoading, setLocalLoading] = useState(false);

  const [aiQuality, setAiQuality] = useState<ContentQuality | null>(null);
  const [aiEvaluating, setAiEvaluating] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [optimizingType, setOptimizingType] = useState<"quality" | "seo" | null>(null);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);

  useEffect(() => {
    setLocalAnalysis(null);
    setAiQuality(null);
    setOptimization(null);
  }, [platform, contentPieceId]);

  // Invalidate local analysis when content changes so it gets refreshed on next open/fetch
  useEffect(() => {
    if (localAnalysis) {
      setLocalAnalysis(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const seoAnalysis = useMemo(() => {
    if (!content) return null;

    const rules = getPlatformRules(platform as Platform);
    const { idealChars, minChars } = rules.content;
    const { keywordDensity: densityRange, requiresH1 } = rules.seo;

    const textContent = content.replace(/<[^>]*>/g, "");
    const characterCount = textContent.length;
    const words = textContent.split(/\s+/).filter((word) => word.length > 0);
    const wordCount = words.length;

    // Keyword density — use platform-specific range
    let keywordDensity: SEOAnalysis["keywordDensity"] = [];
    const keywordTrimmed = keyword.trim().toLowerCase();
    if (keywordTrimmed) {
      const escapedKeyword = escapeRegExp(keywordTrimmed);
      const regex = new RegExp(escapedKeyword, "gi");
      const matches = (textContent.match(regex) || []).length;
      const density = wordCount > 0 ? (matches / wordCount) * 100 : 0;

      let rating: "good" | "low" | "stuffed" = "good";
      if (density < densityRange.min) rating = "low";
      else if (density > densityRange.max) rating = "stuffed";

      keywordDensity = [{ keyword: keyword.trim(), count: matches, density, rating }];
    }

    // Keyword in title — only meaningful if platform uses titles/headings
    const keywordInTitle = (() => {
      if (!keywordTrimmed) return true;
      if (!rules.content.requiresTitle && !requiresH1) return true; // platform doesn't use titles → don't penalize
      const h1Match = content.match(/<h1[^>]*>(.*?)<\/h1>/i);
      if (h1Match) {
        return h1Match[1].replace(/<[^>]*>/g, "").toLowerCase().includes(keywordTrimmed);
      }
      const firstHeading = content.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i);
      if (firstHeading) {
        return firstHeading[1].replace(/<[^>]*>/g, "").toLowerCase().includes(keywordTrimmed);
      }
      return false;
    })();

    const keywordInOpening = keywordTrimmed
      ? textContent.slice(0, 200).toLowerCase().includes(keywordTrimmed)
      : true;

    const headingRegex = /<h([1-6])[^>]*>/gi;
    const headingMatches = [...content.matchAll(headingRegex)];
    const headingCount = headingMatches.length;
    const hasH1 = /<h1[^>]*>/i.test(content);

    let validHierarchy = true;
    if (headingCount > 1) {
      const levels = headingMatches.map((m) => parseInt(m[1], 10));
      for (let i = 1; i < levels.length; i++) {
        if (levels[i] > levels[i - 1] + 1) {
          validHierarchy = false;
          break;
        }
      }
    }

    // ── Scoring (platform-aware) ──

    // Content length: ideal range from platform rules
    let score = 0;
    if (characterCount > 0) score += 10;
    if (characterCount >= idealChars.min && characterCount <= idealChars.max) {
      score += 10; // in ideal range → full points
    } else if (characterCount >= minChars) {
      score += 5; // meets minimum → half points
    }

    // Word count: platform-adaptive (short-form platforms have lower bars)
    const wordThreshold = rules.format.paragraphStyle === "short" ? 20 : 50;
    if (wordCount >= wordThreshold) score += 10;

    // Keyword density: platform-specific range
    if (keywordDensity.length > 0) {
      const densityInfo = keywordDensity[0];
      if (densityInfo.rating === "good") score += 25;
      else if (densityInfo.rating === "low") score += 12;
      else score += 5;
    } else {
      score += 18;
    }

    // Keyword in opening
    if (keywordInOpening) score += 10;

    // Bonus: keyword in title (only if platform uses titles)
    if (keywordInTitle && (rules.content.requiresTitle || requiresH1)) score += 10;

    // Bonus: heading structure (only if platform uses headings)
    if (requiresH1) {
      if (hasH1) score += 6;
      if (headingCount >= 2) score += 4;
      if (validHierarchy && headingCount >= 2) score += 5;
    }

    return {
      characterCount,
      wordCount,
      keywordDensity,
      overallScore: Math.min(100, score),
      keywordInTitle,
      keywordInOpening,
      hasH1,
      headingCount,
      validHierarchy,
    };
  }, [content, keyword, platform]);

  const platformAnalysis = useMemo<PlatformAnalysisResult | null>(() => {
    if (!content) return null;
    return analyzeForPlatform(content, platform as Platform);
  }, [content, platform]);

  useEffect(() => {
    if (isOpen && !localAnalysis && !localLoading) {
      void fetchLocalAnalysis();
    }
  }, [isOpen, localAnalysis, localLoading]);

  const fetchLocalAnalysis = async () => {
    setLocalLoading(true);
    try {
      const res = await fetch(`/api/content/${contentPieceId}/quality/local?platform=${platform}`);
      if (res.ok) {
        const data = (await res.json()) as LocalQualityAnalysis;
        setLocalAnalysis(data);
      } else {
        toast.error("加载稳定分析失败");
      }
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setLocalLoading(false);
    }
  };

  const handleEvaluate = async () => {
    setAiEvaluating(true);
    try {
      const res = await fetch(`/api/content/${contentPieceId}/quality`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      if (res.ok) {
        const data = (await res.json()) as ContentQuality;
        setAiQuality(data);
        toast.success("AI 复核已完成");
      } else {
        const data = await res.json();
        toast.error(data.error || "复核失败");
      }
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setAiEvaluating(false);
    }
  };

  const handleOptimize = async (type: "quality" | "seo") => {
    setOptimizingType(type);
    try {
      const endpoint =
        type === "quality"
          ? `/api/content/${contentPieceId}/optimize`
          : `/api/content/${contentPieceId}/optimize-seo`;
      const body = type === "quality" ? { platform, content } : { content, keyword };

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
    if (!optimization || !onContentUpdate) return;
    const success = await onContentUpdate(optimization.optimized);
    if (success) {
      setOptimization({ ...optimization, applied: true });
      await fetchLocalAnalysis();
    }
  };

  const handleDiscardOptimization = () => {
    setOptimization(null);
  };

  const stableScore = localAnalysis?.overallScore ?? null;
  const stableSuggestions = useMemo(() => {
    const local = localAnalysis?.suggestions ?? [];
    const platform = platformAnalysis?.suggestions ?? [];
    const dedupedPlatform = platform.filter((ps) => {
      const psLower = ps.toLowerCase();
      return !local.some((ls) => {
        const lsLower = ls.toLowerCase();
        if (lsLower.includes(psLower) || psLower.includes(lsLower)) return true;
        const lsWords: string[] = lsLower.match(/[\u4e00-\u9fa5]{2,}/g) || [];
        const psWords: string[] = psLower.match(/[\u4e00-\u9fa5]{2,}/g) || [];
        if (lsWords.length === 0 || psWords.length === 0) return false;
        const overlap = psWords.filter((w) => lsWords.includes(w)).length;
        return overlap / psWords.length > 0.6;
      });
    });
    return [...local, ...dedupedPlatform];
  }, [localAnalysis?.suggestions, platformAnalysis?.suggestions]);

  const seoKeywordMetric = seoAnalysis?.keywordDensity[0] ?? null;

  const seoIssues = useMemo<InsightItem[]>(() => {
    if (!seoAnalysis) return [];
    const rules = getPlatformRules(platform as Platform);
    const { idealChars, minChars, maxChars } = rules.content;
    const { keywordDensity: densityRange, requiresH1 } = rules.seo;
    const wordThreshold = rules.format.paragraphStyle === "short" ? 20 : 50;

    const issues: InsightItem[] = [];
    if (seoAnalysis.characterCount < minChars)
      issues.push({ tone: "warning", text: `内容过短（${seoAnalysis.characterCount}/${minChars}），${platformLabel}至少需要 ${minChars} 字。` });
    else if (seoAnalysis.characterCount < idealChars.min)
      issues.push({ tone: "warning", text: `内容偏短（${seoAnalysis.characterCount}/${idealChars.min}），建议扩展到 ${idealChars.min}-${idealChars.max} 字。` });
    else if (seoAnalysis.characterCount > maxChars)
      issues.push({ tone: "warning", text: `内容过长（${seoAnalysis.characterCount}/${maxChars}），${platformLabel}建议不超过 ${maxChars} 字。` });
    else if (seoAnalysis.characterCount > idealChars.max)
      issues.push({ tone: "info", text: `内容偏长（${seoAnalysis.characterCount}/${idealChars.max}），可以适当精简。` });

    if (seoAnalysis.wordCount < wordThreshold)
      issues.push({ tone: "warning", text: `词数不足（${seoAnalysis.wordCount}/${wordThreshold}），内容深度不够。` });

    if (seoKeywordMetric?.rating === "low")
      issues.push({ tone: "warning", text: `关键词密度偏低（${seoKeywordMetric.density.toFixed(1)}%），${platformLabel}建议 ${densityRange.min}-${densityRange.max}%。` });
    if (seoKeywordMetric?.rating === "stuffed")
      issues.push({ tone: "danger", text: `关键词密度过高（${seoKeywordMetric.density.toFixed(1)}%），${platformLabel}建议不超过 ${densityRange.max}%。` });

    if (requiresH1 && !seoAnalysis.hasH1)
      issues.push({ tone: "warning", text: "缺少 H1 标题，建议添加包含核心关键词的主标题。" });
    if ((rules.content.requiresTitle || requiresH1) && !seoAnalysis.keywordInTitle)
      issues.push({ tone: "warning", text: "关键词未出现在标题中，将关键词加入标题有助于搜索排名。" });
    if (!seoAnalysis.keywordInOpening)
      issues.push({ tone: "info", text: "关键词未在开头段落出现，建议在前 200 字内自然引入。" });
    if (requiresH1 && seoAnalysis.headingCount > 1 && !seoAnalysis.validHierarchy)
      issues.push({ tone: "warning", text: "标题层级存在跳跃（如 H1 直接跳到 H3），建议按 H1→H2→H3 递进。" });

    if (issues.length === 0)
      issues.push({ tone: "success", text: `当前 SEO 指标符合${platformLabel}平台要求，可以考虑做细节微调。` });
    return issues;
  }, [seoAnalysis, seoKeywordMetric, platform]);

  const qualityMetrics = localAnalysis
    ? [
        { label: "可读性", value: localAnalysis.localMetrics.readabilityScore, isGood: localAnalysis.localMetrics.readabilityScore >= 70 },
        { label: "结构质量", value: localAnalysis.structure.structureScore, isGood: localAnalysis.structure.structureScore >= 70 },
        { label: "一致性", value: localAnalysis.localMetrics.consistencyScore, isGood: localAnalysis.localMetrics.consistencyScore >= 70 },
        { label: "词汇多样性", value: `${Math.round(localAnalysis.localMetrics.vocabularyDiversity * 100)}%`, isGood: localAnalysis.localMetrics.vocabularyDiversity >= 0.35 },
      ]
    : [];

  const platformLabel = getPlatformLabel(platform as Platform);
  const currentPlatformRules = getPlatformRules(platform as Platform);
  const platformBlueprint = platformAnalysis ? getPlatformBlueprint(platform as Platform) : null;
  const platformHints = platformAnalysis
    ? [
        { label: "平台适配", value: platformAnalysis.score, isGood: platformAnalysis.score >= 70 },
        { label: "长度", value: platformAnalysis.checks.contentLength.score, isGood: platformAnalysis.checks.contentLength.passed },
        { label: "标题/开头", value: platformAnalysis.checks.title.score, isGood: platformAnalysis.checks.title.passed },
        { label: "格式/承载", value: platformAnalysis.checks.format.score, isGood: platformAnalysis.checks.format.passed },
      ]
    : [];

  // ── Render ──

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm ring-1 ring-black/5">
      {/* Collapsed header */}
      <button
        onClick={() => setIsOpen((open) => !open)}
        className="w-full bg-[linear-gradient(180deg,rgba(99,102,241,0.06),rgba(99,102,241,0))] px-4 py-3 text-left transition-colors hover:bg-secondary/20 sm:px-5"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wand2 className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">AI 内容优化</span>
                {!isOpen && optimization && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    待处理
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stableScore !== null && (
              <ScoreBadge label="评分" value={stableScore} color={getQualityScoreColor(stableScore)} />
            )}
            {platformAnalysis && (
              <ScoreBadge label={`${platformLabel}适配`} value={platformAnalysis.score} color={getQualityScoreColor(platformAnalysis.score)} />
            )}
            {seoAnalysis && (
              <ScoreBadge label="SEO" value={seoAnalysis.overallScore} color={getSEOScoreColor(seoAnalysis.overallScore)} />
            )}
            <div className="flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground">
              {isOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </div>
          </div>
        </div>
      </button>

      {/* Expanded body */}
      {isOpen && (
        <div className="border-t border-border/80">
          {/* Tab bar */}
          <div className="flex gap-1 border-b border-border/60 px-3 py-2">
            <TabChip
              active={activeTab === "quality"}
              icon={Sparkles}
              label="内容质量"
              tone="purple"
              onClick={() => {
                setActiveTab("quality");
                if (optimization?.type === "seo") setOptimization(null);
              }}
            />
            <TabChip
              active={activeTab === "seo"}
              icon={Search}
              label="SEO 分析"
              tone="blue"
              onClick={() => {
                setActiveTab("seo");
                if (optimization?.type === "quality") setOptimization(null);
              }}
            />
          </div>

          {/* ─── Quality tab ─── */}
          <div className="px-4 py-3 sm:px-5">
            {activeTab === "quality" && (
              <div className="space-y-3">
                {localLoading ? (
                  <EmptyState icon={RotateCw} title="正在加载" description="读取本地分析结果..." spinning />
                ) : !localAnalysis ? (
                  <EmptyState
                    icon={Sparkles}
                    title="还没有分析结果"
                    description="先做一次本地分析，面板才会显示评分和维度。"
                    action={
                      <Button onClick={fetchLocalAnalysis} disabled={localLoading} size="sm">
                        {localLoading ? "分析中..." : "开始分析"}
                      </Button>
                    }
                  />
                ) : (
                  <>
                    {/* ═══ Section 1: 分析维度及评分 ═══ */}
                    <section className="space-y-2">
                      <SectionDivider icon={BarChart3} title="分析维度" />

                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        {qualityMetrics.map((m) => (
                          <InlineMetric key={m.label} label={m.label} value={m.value} isGood={m.isGood} />
                        ))}
                      </div>

                      {platformAnalysis && (
                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                          {platformHints.map((m) => (
                            <InlineMetric key={m.label} label={m.label} value={m.value} isGood={m.isGood} />
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        <InlineMetric
                          label="情绪倾向"
                          value={localAnalysis.sentiment.overall === "positive" ? "积极" : localAnalysis.sentiment.overall === "negative" ? "消极" : "中性"}
                          isGood={localAnalysis.sentiment.overall !== "negative"}
                        />
                        <InlineMetric label="段落数量" value={localAnalysis.structure.paragraphCount} isGood={localAnalysis.structure.paragraphCount >= 2} />
                        <InlineMetric label="标题层级" value={localAnalysis.structure.headingHierarchy.length} isGood={localAnalysis.structure.headingHierarchy.length >= 1} />
                        <InlineMetric label="关键词数量" value={localAnalysis.keywords.length} isGood={localAnalysis.keywords.length >= 3} />
                      </div>

                      {platformBlueprint && (
                        <details className="group rounded-lg border border-border/40">
                          <summary className="flex cursor-pointer items-center justify-between px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                            <span>{platformLabel} 细分维度 · {platformBlueprint.description}</span>
                            <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
                          </summary>
                          <div className="space-y-2 border-t border-border/30 px-3 py-2">
                            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                              {platformBlueprint.dimensions.map((d) => (
                                <div key={d.label} className="rounded-md bg-muted/40 px-2 py-1.5">
                                  <div className="text-[11px] font-medium text-foreground">{d.label}</div>
                                  <div className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{d.description}</div>
                                </div>
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {platformAnalysis!.rules.optimization.focusAreas.map((area: string) => (
                                <span key={area} className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-700">
                                  {area}
                                </span>
                              ))}
                            </div>
                          </div>
                        </details>
                      )}
                    </section>

                    {/* ═══ Section 2: 分析建议 ═══ */}
                    {stableSuggestions.length > 0 && (
                      <section className="space-y-1.5">
                        <SectionDivider icon={Lightbulb} title="分析建议" />
                        <ul className="space-y-1">
                          {stableSuggestions.map((suggestion, i) => (
                            <li
                              key={`sug-${i}`}
                              className="flex items-start gap-2 rounded-md bg-muted/30 px-2.5 py-1.5 text-xs leading-5 text-muted-foreground"
                            >
                              <Sparkles className="mt-0.5 size-3 shrink-0 text-purple-500" />
                              <span>{suggestion}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {/* ═══ Section 3: AI 复核 & 优化 ═══ */}
                    <section className="space-y-2">
                      <SectionDivider
                        icon={Sparkles}
                        title="AI 复核 & 优化"
                        right={
                          <Button
                            onClick={handleEvaluate}
                            disabled={aiEvaluating}
                            size="sm"
                            variant="ghost"
                            className="h-6 gap-1 px-2 text-[11px]"
                          >
                            <RotateCw className={cn("size-3", aiEvaluating && "animate-spin")} />
                            {aiEvaluating ? "复核中" : "AI 复核"}
                          </Button>
                        }
                      />

                      {aiQuality ? (
                        <div className="space-y-1.5">
                          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                            <AIScorePill label="质量" score={aiQuality.quality} />
                            <AIScorePill label="吸引力" score={aiQuality.engagement} />
                            <AIScorePill label="品牌调性" score={aiQuality.brandVoice} />
                            <AIScorePill label="平台适配" score={aiQuality.platformFit} />
                          </div>
                          {(() => {
                            try {
                              const aiSuggestions = typeof aiQuality.suggestions === "string"
                                ? JSON.parse(aiQuality.suggestions) : aiQuality.suggestions;
                              if (Array.isArray(aiSuggestions) && aiSuggestions.length > 0) {
                                return (
                                  <ul className="space-y-1">
                                    {aiSuggestions.map((s: string, i: number) => (
                                      <li
                                        key={`ai-${i}`}
                                        className="flex items-start gap-2 rounded-md bg-indigo-50/40 px-2.5 py-1.5 text-xs leading-5 text-muted-foreground"
                                      >
                                        <Sparkles className="mt-0.5 size-3 shrink-0 text-indigo-400" />
                                        <span>{s}</span>
                                      </li>
                                    ))}
                                  </ul>
                                );
                              }
                            } catch { /* ignore */ }
                            return null;
                          })()}
                        </div>
                      ) : (
                        <p className="px-1 text-[11px] text-muted-foreground">
                          还没有 AI 复核结果。需要时再生成，稳定评分和平台适配不会依赖它。
                        </p>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          onClick={() => handleOptimize("quality")}
                          disabled={optimizingType !== null || !content}
                          size="sm"
                          className="gap-1.5"
                        >
                          <Wand2 className="size-3.5" />
                          {optimizingType === "quality" ? "优化中..." : "生成质量优化"}
                        </Button>
                        <Button
                          onClick={fetchLocalAnalysis}
                          disabled={localLoading}
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                        >
                          <RotateCw className="size-3.5" />
                          {localLoading ? "分析中..." : "刷新分析"}
                        </Button>
                      </div>
                    </section>
                  </>
                )}
              </div>
            )}

            {/* ─── SEO tab ─── */}
            {activeTab === "seo" && (
              <div className="space-y-3">
                {/* ═══ Section 1: SEO 指标 ═══ */}
                <section className="space-y-2">
                  <SectionDivider
                    icon={Search}
                    title="SEO 指标"
                    right={
                      seoAnalysis && (
                        <span className={cn("text-xs font-bold tabular-nums", getSEOScoreColor(seoAnalysis.overallScore))}>
                          {seoAnalysis.overallScore}
                        </span>
                      )
                    }
                  />
                  <Input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="输入要优化的关键词..."
                    className="h-8 bg-background text-sm"
                  />
                  {seoAnalysis && (
                    <>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        <InlineMetric
                          label="字符数"
                          value={seoAnalysis.characterCount}
                          isGood={seoAnalysis.characterCount >= currentPlatformRules.content.idealChars.min && seoAnalysis.characterCount <= currentPlatformRules.content.idealChars.max}
                        />
                        <InlineMetric
                          label="词数"
                          value={seoAnalysis.wordCount}
                          isGood={seoAnalysis.wordCount >= (currentPlatformRules.format.paragraphStyle === "short" ? 20 : 50)}
                        />
                        {seoKeywordMetric && (
                          <InlineMetric label="关键词密度" value={`${seoKeywordMetric.density.toFixed(1)}%`} isGood={seoKeywordMetric.rating === "good"} />
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        <InlineMetric label="标题含关键词" value={seoAnalysis.keywordInTitle ? "是" : "否"} isGood={seoAnalysis.keywordInTitle} />
                        <InlineMetric label="开头含关键词" value={seoAnalysis.keywordInOpening ? "是" : "否"} isGood={seoAnalysis.keywordInOpening} />
                        <InlineMetric label="标题结构" value={seoAnalysis.headingCount} isGood={seoAnalysis.headingCount >= 2 && seoAnalysis.validHierarchy} />
                        <InlineMetric label="H1 标题" value={seoAnalysis.hasH1 ? "有" : "缺"} isGood={seoAnalysis.hasH1 || !currentPlatformRules.seo.requiresH1} />
                      </div>
                    </>
                  )}
                </section>

                {/* ═══ Section 2: 问题与建议 ═══ */}
                {seoAnalysis && seoIssues.length > 0 && (
                  <section className="space-y-1.5">
                    <SectionDivider icon={Lightbulb} title="问题与建议" />
                    <ul className="space-y-1">
                      {seoIssues.map((item, i) => (
                        <li
                          key={`seo-issue-${i}`}
                          className="flex items-start gap-2 rounded-md bg-muted/30 px-2.5 py-1.5 text-xs leading-5 text-muted-foreground"
                        >
                          <IssueIndicator tone={item.tone} />
                          <span>{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* ═══ Section 3: SEO 优化 ═══ */}
                <section className="space-y-2">
                  <SectionDivider icon={Wand2} title="SEO 优化" />
                  <p className="px-1 text-[11px] text-muted-foreground">
                    基于当前关键词和文案状态做定向改写，不会用模板式通改。
                  </p>
                  <Button
                    onClick={() => handleOptimize("seo")}
                    disabled={optimizingType !== null || !content || !keyword.trim()}
                    size="sm"
                    className="gap-1.5"
                  >
                    <Search className="size-3.5" />
                    {optimizingType === "seo" ? "优化中..." : "生成 SEO 优化"}
                  </Button>
                </section>
              </div>
            )}
          </div>

          {/* Optimization result */}
          {optimization && (
            <div className="border-t border-border/80 bg-muted/30 px-4 py-3 sm:px-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex size-7 items-center justify-center rounded-lg",
                      optimization.type === "quality" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                    )}
                  >
                    {optimization.type === "quality" ? <Sparkles className="size-3.5" /> : <Search className="size-3.5" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-foreground">
                      {optimization.type === "quality" ? "质量优化结果" : "SEO 优化结果"}
                    </h4>
                  </div>
                </div>
                {!optimization.applied ? (
                  <div className="flex gap-1.5">
                    <Button onClick={handleApplyOptimization} size="sm" className="h-7 gap-1 text-xs">
                      <Check className="size-3" />
                      应用
                    </Button>
                    <Button onClick={handleDiscardOptimization} size="sm" variant="outline" className="h-7 gap-1 text-xs">
                      <X className="size-3" />
                      放弃
                    </Button>
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                    <CheckCircle2 className="size-3.5" />
                    已应用
                  </span>
                )}
              </div>
              {optimization.diff && (
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-2.5 text-xs leading-5 text-muted-foreground">
                  {optimization.diff}
                </pre>
              )}
              <details className="group mt-2">
                <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                  查看完整对比
                </summary>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <PreviewCard title="原始内容" accent="red" content={optimization.original} />
                  <PreviewCard title="优化后内容" accent="green" content={optimization.optimized} />
                </div>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Helper components
   ═══════════════════════════════════════════ */

function ScoreBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-2 py-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={cn("text-xs font-bold tabular-nums", color)}>{value}</span>
    </div>
  );
}

function TabChip({
  active,
  icon: Icon,
  label,
  tone,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  tone: "purple" | "blue";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? tone === "purple"
            ? "bg-purple-50 text-purple-700 ring-1 ring-purple-200/60"
            : "bg-blue-50 text-blue-700 ring-1 ring-blue-200/60"
          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

function SectionDivider({
  icon: Icon,
  title,
  right,
}: {
  icon: LucideIcon;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-3 text-muted-foreground/60" />
      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground/80">{title}</span>
      <div className="h-px flex-1 bg-border/40" />
      {right}
    </div>
  );
}

function InlineMetric({
  label,
  value,
  isGood,
}: {
  label: string;
  value: number | string;
  isGood: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md border px-2 py-1",
        isGood ? "border-emerald-200/50 bg-emerald-50/30" : "border-amber-200/50 bg-amber-50/30"
      )}
    >
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-xs font-semibold tabular-nums",
          isGood ? "text-emerald-700" : "text-amber-700"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function AIScorePill({ label, score }: { label: string; score: number }) {
  const color = score >= 7 ? "text-emerald-700" : score >= 5 ? "text-amber-700" : "text-red-600";
  return (
    <div className="flex items-center justify-between rounded-md border border-border/40 bg-background px-2 py-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={cn("text-xs font-bold tabular-nums", color)}>{score}/10</span>
    </div>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  spinning?: boolean;
}

function EmptyState({ icon: Icon, title, description, action, spinning }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-6 text-center">
      <div className="mx-auto flex size-8 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
        <Icon className={cn("size-3.5", spinning && "animate-spin")} />
      </div>
      <h4 className="mt-2 text-xs font-medium text-foreground">{title}</h4>
      <p className="mx-auto mt-1 max-w-sm text-[11px] leading-5 text-muted-foreground">{description}</p>
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

function IssueIndicator({ tone }: { tone: InsightTone }) {
  if (tone === "success") return <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-emerald-600" />;
  if (tone === "danger") return <AlertCircle className="mt-0.5 size-3 shrink-0 text-red-600" />;
  if (tone === "warning") return <AlertCircle className="mt-0.5 size-3 shrink-0 text-amber-600" />;
  return <Lightbulb className="mt-0.5 size-3 shrink-0 text-blue-600" />;
}

function PreviewCard({
  title,
  accent,
  content,
}: {
  title: string;
  accent: "red" | "green";
  content: string;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-medium text-muted-foreground">{title}</div>
      <div
        className={cn(
          "whitespace-pre-wrap rounded-md border p-2 text-[11px] leading-5 text-muted-foreground",
          accent === "red" ? "border-red-100 bg-red-50/60" : "border-green-100 bg-green-50/60"
        )}
      >
        {content.slice(0, 300)}
        {content.length > 300 ? "..." : ""}
      </div>
    </div>
  );
}

function getQualityScoreColor(score: number) {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
}

function getSEOScoreColor(score: number) {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
}

function getPlatformLabel(platform: Platform) {
  const labels: Record<Platform, string> = { wechat: "微信", weibo: "微博", xiaohongshu: "小红书", douyin: "抖音" };
  return labels[platform];
}

function getPlatformBlueprint(platform: Platform): {
  description: string;
  dimensions: PlatformDimension[];
} {
  switch (platform) {
    case "wechat":
      return {
        description: "长文阅读和转化导向",
        dimensions: [
          { label: "标题钩子", description: "标题要明确利益点，避免过长或过虚。", hint: "优先看开头 1 句是否能拉住读者。" },
          { label: "结构分层", description: "用小标题和段落把内容拆清楚。", hint: "适合用 H2 / H3 组织信息。" },
          { label: "开头导入", description: "前 50 字要直接进入主题。", hint: "不要铺垫太久。" },
          { label: "结尾转化", description: "自然引导关注、收藏或留言。", hint: "结尾最好留一个动作。" },
        ],
      };
    case "weibo":
      return {
        description: "短促表达和互动传播",
        dimensions: [
          { label: "首句抓力", description: "第一句话就要足够有冲击力。", hint: "前两句决定是否继续看。" },
          { label: "话题标签", description: "用少量话题放大传播范围。", hint: "保持 1-3 个高相关标签。" },
          { label: "长度控制", description: "尽量短、快、密，不拖沓。", hint: "长内容要压缩成核心观点。" },
          { label: "互动引导", description: "鼓励评论、转发、@ 朋友。", hint: "结尾最好带一个提问。" },
        ],
      };
    case "xiaohongshu":
      return {
        description: "真实体验和种草表达",
        dimensions: [
          { label: "标题种草", description: "标题要有场景感和明确收益点。", hint: "20-50 字通常更合适。" },
          { label: "真实感", description: "第一人称、体验过程和细节很重要。", hint: "少说空话，多说感受。" },
          { label: "细节密度", description: "多写场景、步骤、对比和结果。", hint: "越具体越容易被收藏。" },
          { label: "视觉承载", description: "图文结构和留白决定阅读体验。", hint: "尽量为图片和分段留空间。" },
        ],
      };
    case "douyin":
      return {
        description: "前三秒钩子和节奏控制",
        dimensions: [
          { label: "前三秒钩子", description: "开头必须快速抛出冲突或收益点。", hint: "先让人停下来，再讲内容。" },
          { label: "节奏变化", description: "每隔几秒都要有信息变化。", hint: "避免一口气平铺。" },
          { label: "叙事结构", description: "常见结构是问题 - 行动 - 结果。", hint: "脚本要有推进感。" },
          { label: "互动召唤", description: "结尾引导关注、点赞、评论。", hint: "动作要非常明确。" },
        ],
      };
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
