"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronUp, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface SEOProps {
  content: string;
  onContentUpdate?: (newContent: string) => void;
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

interface SEOOptimizationResult {
  original: string;
  optimized: string;
  diff: string;
  applied: boolean;
}

export function SEOScorer({ content, onContentUpdate }: SEOProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [debouncedContent, setDebouncedContent] = useState(content);
  const [optimizing, setOptimizing] = useState(false);
  const [optimization, setOptimization] = useState<SEOOptimizationResult | null>(null);

  // Debounced content update (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedContent(content);
    }, 300);
    return () => clearTimeout(timer);
  }, [content]);

  // Analyze SEO metrics
  const analysis: SEOAnalysis = useMemo(() => {
    if (!debouncedContent) {
      return {
        characterCount: 0,
        wordCount: 0,
        keywordDensity: [],
        overallScore: 0,
      };
    }

    // Strip HTML tags for text analysis
    const textContent = debouncedContent.replace(/<[^>]*>/g, "");
    const characterCount = textContent.length;
    const words = textContent.split(/\s+/).filter((w) => w.length > 0);
    const wordCount = words.length;

    // Calculate keyword density if keyword is provided
    let keywordDensity: SEOAnalysis["keywordDensity"] = [];
    if (keyword.trim()) {
      const keywordLower = keyword.toLowerCase();
      const regex = new RegExp(keywordLower, "gi");
      const matches = (textContent.match(regex) || []).length;
      const density = wordCount > 0 ? (matches / wordCount) * 100 : 0;

      let rating: "good" | "low" | "stuffed" = "good";
      if (density < 2) rating = "low";
      else if (density > 5) rating = "stuffed";

      keywordDensity = [
        {
          keyword: keyword,
          count: matches,
          density,
          rating,
        },
      ];
    }

    // Calculate overall score (0-100)
    let score = 0;
    if (characterCount > 0) score += 20; // Has content
    if (characterCount >= 300) score += 20; // Good length
    if (wordCount >= 50) score += 20; // Enough words
    if (keywordDensity.length > 0) {
      const kd = keywordDensity[0];
      if (kd.rating === "good") score += 40;
      else if (kd.rating === "low") score += 20;
      else score += 10; // stuffed is better than nothing
    } else {
      score += 30; // No keyword analysis, neutral
    }

    return {
      characterCount,
      wordCount,
      keywordDensity,
      overallScore: score,
    };
  }, [debouncedContent, keyword]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  };

  const getDensityRating = (rating: string) => {
    switch (rating) {
      case "good":
        return { text: "合适", color: "text-green-600" };
      case "low":
        return { text: "偏低", color: "text-amber-600" };
      case "stuffed":
        return { text: "过高", color: "text-red-600" };
      default:
        return { text: "未知", color: "text-gray-600" };
    }
  };

  return (
    <div className="border border-border rounded-lg bg-card">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex justify-between items-center hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-medium">SEO 分析</span>
          <span className={`text-lg font-bold ${getScoreColor(analysis.overallScore)}`}>
            {analysis.overallScore}/100
          </span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {isOpen && (
        <div className="px-4 py-3 border-t border-border space-y-4">
          {/* Keyword input */}
          <div>
            <label className="block text-sm font-medium mb-1">目标关键词</label>
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="输入要分析的关键词..."
              className="max-w-xs"
            />
          </div>

          {/* Character count */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-muted-foreground">字符数</span>
              <span className="text-sm font-medium">{analysis.characterCount}</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, (analysis.characterCount / 2000) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              建议长度: 300-2000 字符
            </p>
          </div>

          {/* Word count */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-muted-foreground">词数</span>
              <span className="text-sm font-medium">{analysis.wordCount}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              建议至少 50 个词
            </p>
          </div>

          {/* Keyword density */}
          {keyword.trim() && analysis.keywordDensity.length > 0 && (
            <div>
              <span className="text-sm text-muted-foreground mb-2 block">
                关键词密度
              </span>
              {analysis.keywordDensity.map((kd, index) => {
                const rating = getDensityRating(kd.rating);
                return (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{kd.keyword}</span>
                      <span className={`text-sm ${rating.color}`}>
                        {rating.text}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>出现 {kd.count} 次</span>
                      <span>密度: {kd.density.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          kd.rating === "good"
                            ? "bg-green-600"
                            : kd.rating === "low"
                            ? "bg-amber-600"
                            : "bg-red-600"
                        }`}
                        style={{ width: `${Math.min(100, kd.density * 10)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      建议密度: 2-5%
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tips */}
          <div className="text-xs text-muted-foreground bg-secondary/50 p-3 rounded">
            <p className="font-medium mb-1">SEO 优化建议：</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>关键词密度保持在 2-5% 之间效果最佳</li>
              <li>标题和开头出现关键词有助于搜索引擎理解</li>
              <li>内容长度建议 300-2000 字符</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
