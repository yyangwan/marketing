/**
 * Platform Optimizer Component
 *
 * Displays platform-specific content analysis and provides AI optimization.
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface PlatformOptimizerProps {
  contentPieceId: string;
  platform: "wechat" | "weibo" | "xiaohongshu" | "douyin";
  content: string;
}

interface PlatformAnalysis {
  score: number;
  checks: {
    contentLength: { passed: boolean; score: number; issues: string[] };
    title: { passed: boolean; score: number; issues: string[] };
    seo: { passed: boolean; score: number; issues: string[] };
    format: { passed: boolean; score: number; issues: string[] };
  };
  suggestions: string[];
}

interface OptimizationResult {
  original: string;
  optimized: string;
  diff: string;
  applied: boolean;
}

const PLATFORM_NAMES = {
  wechat: "微信",
  weibo: "微博",
  xiaohongshu: "小红书",
  douyin: "抖音",
};

export function PlatformOptimizer({
  contentPieceId,
  platform,
  content,
}: PlatformOptimizerProps) {
  const [analysis, setAnalysis] = useState<PlatformAnalysis | null>(null);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Analyze content on mount
  useEffect(() => {
    analyzeContent();
  }, [contentPieceId, platform]);

  async function analyzeContent() {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/content/${contentPieceId}/analyze?platform=${platform}`
      );
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
      }
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOptimize() {
    setIsOptimizing(true);
    try {
      const res = await fetch(`/api/content/${contentPieceId}/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, content }),
      });

      if (res.ok) {
        const data = await res.json();
        setOptimization(data);
      }
    } catch (error) {
      console.error("Optimization failed:", error);
    } finally {
      setIsOptimizing(false);
    }
  }

  function handleApplyOptimization() {
    if (optimization) {
      // TODO: Update content in editor
      setOptimization({ ...optimization, applied: true });
    }
  }

  function getScoreColor(score: number): string {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  }

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-500">分析中...</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Platform Analysis Display */}
      {analysis && (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {PLATFORM_NAMES[platform]} 平台分析
            </h3>
            <div className={`text-2xl font-bold ${getScoreColor(analysis.score)}`}>
              {analysis.score}分
            </div>
          </div>

          {/* Rule Checks */}
          <div className="space-y-2 text-sm">
            {Object.entries(analysis.checks).map(([key, check]) => (
              <div
                key={key}
                className="flex items-center justify-between p-2 bg-gray-50 rounded"
              >
                <span className="capitalize">{key}</span>
                <span
                  className={check.passed ? "text-green-600" : "text-red-600"}
                >
                  {check.score}分
                </span>
              </div>
            ))}
          </div>

          {/* Suggestions */}
          {analysis.suggestions.length > 0 && (
            <div className="space-y-1">
              <h4 className="font-medium text-sm">优化建议:</h4>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                {analysis.suggestions.map((suggestion, i) => (
                  <li key={i}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Optimize Button */}
      <Button
        onClick={handleOptimize}
        disabled={isOptimizing}
        className="w-full"
      >
        {isOptimizing ? "优化中..." : "AI 一键优化"}
      </Button>

      {/* Optimization Result */}
      {optimization && (
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="text-lg font-semibold">优化结果</h3>

          {!optimization.applied && (
            <div className="flex gap-2">
              <Button onClick={handleApplyOptimization} size="sm">
                应用优化
              </Button>
              <Button onClick={() => setOptimization(null)} size="sm" variant="outline">
                放弃
              </Button>
            </div>
          )}

          {optimization.applied && (
            <div className="text-sm text-green-600">✓ 优化已应用</div>
          )}

          {/* Diff Display */}
          {optimization.diff && (
            <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-64">
              {optimization.diff}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
