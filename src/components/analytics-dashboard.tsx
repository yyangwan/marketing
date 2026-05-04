"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  TrendingUp,
  CheckCircle,
  Users,
  BarChart3,
  Calendar,
} from "lucide-react";
import { STATUS_COLUMNS, PLATFORM_CONFIG } from "@/types";
import type { ContentStatus, Platform } from "@/types";

interface AnalyticsData {
  summary: {
    totalContent: number;
    avgQualityScore: number;
    avgEngagementScore: number;
    avgBrandVoiceScore: number;
    avgPlatformFitScore: number;
    publishSuccessRate: number;
    scheduledCount: number;
    publishedCount: number;
  };
  distributions: {
    byStatus: Record<string, number>;
    byPlatform: Record<string, number>;
  };
  trends: {
    contentOverTime: Array<{ date: string; count: number }>;
    qualityOverTime: Array<{ date: string; score: number }>;
  };
  recentActivity: Array<{
    id: string;
    title: string;
    status: string;
    projectName: string;
    createdAt: Date;
  }>;
  topProjects: Array<{
    id: string;
    name: string;
    contentCount: number;
  }>;
}

// Build lookup maps from the canonical STATUS_COLUMNS and PLATFORM_CONFIG
const STATUS_LABEL_MAP = Object.fromEntries(
  STATUS_COLUMNS.map((s) => [s.key, s.label])
) as Record<string, string>;

const STATUS_COLOR_MAP = Object.fromEntries(
  STATUS_COLUMNS.map((s) => [s.key, s.color])
) as Record<string, string>;

const PLATFORM_LABEL_MAP = Object.fromEntries(
  (Object.entries(PLATFORM_CONFIG) as [Platform, typeof PLATFORM_CONFIG[Platform]][]).map(
    ([key, cfg]) => [key, cfg.label]
  )
) as Record<string, string>;

const MAX_TREND_BARS = 14; // Limit visible bars to prevent overflow

interface AnalyticsDashboardProps {
  workspaceId: string;
}

export function AnalyticsDashboard({ workspaceId }: AnalyticsDashboardProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("30"); // days

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange, workspaceId]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/analytics?timeRange=${timeRange}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else if (response.status === 401) {
        setError("请先登录");
      } else {
        setError("加载失败，请稍后重试");
      }
    } catch {
      setError("网络错误，请检查连接");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-muted-foreground">{error}</p>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 text-sm border rounded-md hover:bg-secondary transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { summary, distributions, trends, recentActivity, topProjects } = data;

  // Trim trend data to max bars (keep most recent)
  const visibleContentTrend = trends.contentOverTime.slice(-MAX_TREND_BARS);
  const visibleQualityTrend = trends.qualityOverTime.slice(-MAX_TREND_BARS);

  // Calculate max values for bar charts
  const maxContentCount = Math.max(
    ...visibleContentTrend.map((d) => d.count),
    1
  );

  const hasData = summary.totalContent > 0;

  return (
    <div className="p-6 space-y-6 overflow-auto">
      {/* Time range selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">时间范围：</span>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="7">最近 7 天</option>
            <option value="30">最近 30 天</option>
            <option value="90">最近 90 天</option>
          </select>
        </div>
      </div>

      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              title="内容总数"
              value={summary.totalContent}
              icon={FileText}
              color="text-blue-600"
              bgColor="bg-blue-50"
              description="所选时间范围内创建的所有内容数量（含草稿和已发布）"
            />
            <SummaryCard
              title="平均质量分"
              value={summary.avgQualityScore.toFixed(1)}
              icon={TrendingUp}
              color="text-green-600"
              bgColor="bg-green-50"
              suffix="/10"
              description="AI 复核对内容专业性、逻辑和表达的综合评分均值"
            />
            <SummaryCard
              title="发布成功率"
              value={`${summary.publishSuccessRate}%`}
              icon={CheckCircle}
              color="text-purple-600"
              bgColor="bg-purple-50"
              description="已发布内容占尝试发布总数的比例，反映发布流程的稳定性"
            />
            <SummaryCard
              title="活跃项目"
              value={topProjects.length}
              icon={Users}
              color="text-orange-600"
              bgColor="bg-orange-50"
              description="所选时间范围内有内容产出的项目数量"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Content Trend Chart */}
            <ChartCard title="内容生成趋势" description="按天统计新建内容的数量变化，帮助识别产出节奏是否稳定">
              {visibleContentTrend.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">暂无数据</p>
              ) : (
                <div className="space-y-2">
                  {visibleContentTrend.map((item) => (
                    <div key={item.date} className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground w-[52px] shrink-0 text-right">
                        {formatDate(item.date)}
                      </span>
                      <div className="flex-1 h-8 bg-muted rounded overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{
                            width: `${(item.count / maxContentCount) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>

            {/* Quality Trend Chart */}
            <ChartCard title="质量评分趋势" description="AI 质量评分的日均走势，持续上升说明内容迭代有效">
              {visibleQualityTrend.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">暂无数据</p>
              ) : (
                <div className="space-y-2">
                  {visibleQualityTrend.map((item) => (
                    <div key={item.date} className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground w-[52px] shrink-0 text-right">
                        {formatDate(item.date)}
                      </span>
                      <div className="flex-1 h-8 bg-muted rounded overflow-hidden">
                        <div
                          className="h-full bg-green-500 transition-all"
                          style={{
                            width: `${(item.score / 10) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">
                        {item.score.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>
          </div>

          {/* Distribution Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Distribution */}
            <ChartCard title="内容状态分布" description="各状态的内容数量占比，用于判断内容管线是否有堵塞">
              {Object.keys(distributions.byStatus).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">暂无数据</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(distributions.byStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${STATUS_COLOR_MAP[status] || "bg-gray-100 text-gray-700"}`}
                      >
                        {STATUS_LABEL_MAP[status] || status}
                      </span>
                      <span className="text-sm font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>

            {/* Platform Distribution */}
            <ChartCard title="平台内容分布" description="各平台的内容产出数量，可用来评估平台覆盖是否均衡">
              {Object.keys(distributions.byPlatform).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">暂无数据</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(distributions.byPlatform).map(([platform, count]) => (
                    <div key={platform} className="flex items-center justify-between">
                      <span className="text-sm">
                        {PLATFORM_LABEL_MAP[platform] || platform}
                      </span>
                      <span className="text-sm font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>
          </div>

          {/* Quality Scores Breakdown */}
          <ChartCard title="质量评分详情" description="AI 复核的四项子评分均值，从不同维度衡量内容表现">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <QualityScoreCard
                label="内容质量"
                score={summary.avgQualityScore}
                description="专业性与逻辑性"
              />
              <QualityScoreCard
                label="吸引力"
                score={summary.avgEngagementScore}
                description="标题和开头的抓取力"
              />
              <QualityScoreCard
                label="品牌调性"
                score={summary.avgBrandVoiceScore}
                description="与品牌语调的吻合度"
              />
              <QualityScoreCard
                label="平台适配"
                score={summary.avgPlatformFitScore}
                description="符合平台写作规范的程度"
              />
            </div>
          </ChartCard>

          {/* Recent Activity & Top Projects */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <ChartCard title="最近内容" description="最新创建的 5 篇内容及其当前状态">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">暂无内容</p>
              ) : (
                <div className="space-y-2">
                  {recentActivity.slice(0, 5).map((item) => (
                    <Link
                      key={item.id}
                      href={`/content/${item.id}`}
                      className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.projectName}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-xs ml-2 ${STATUS_COLOR_MAP[item.status] || "bg-gray-100 text-gray-700"}`}
                      >
                        {STATUS_LABEL_MAP[item.status] || item.status}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </ChartCard>

            {/* Top Projects */}
            <ChartCard title="活跃项目" description="按内容产出量排序的项目列表，反映团队精力分布">
              {topProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">暂无项目</p>
              ) : (
                <div className="space-y-2">
                  {topProjects.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{project.name}</span>
                      </div>
                      <span className="text-sm font-medium">{project.contentCount} 篇</span>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  color,
  bgColor,
  suffix = "",
  description,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  suffix?: string;
  description?: string;
}) {
  return (
    <div className="bg-card rounded-lg p-4 border border-border">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1">
            {value}
            {suffix}
          </p>
          {description && (
            <p className="text-[11px] text-muted-foreground/70 mt-1 leading-4">{description}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${bgColor}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-lg p-4 border border-border">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="text-[11px] text-muted-foreground/70 mt-0.5 leading-4">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function QualityScoreCard({
  label,
  score,
  description,
}: {
  label: string;
  score: number;
  description?: string;
}) {
  const clampedScore = Math.max(0, Math.min(10, score));
  const percentage = (clampedScore / 10) * 100;
  // Score-based color: green >=7, amber 5-7, red <5
  const scoreColor =
    clampedScore >= 7 ? "text-emerald-600" : clampedScore >= 5 ? "text-amber-600" : "text-red-600";
  const ringColor =
    clampedScore >= 7 ? "stroke-emerald-500" : clampedScore >= 5 ? "stroke-amber-500" : "stroke-red-500";
  const bgColor =
    clampedScore >= 7 ? "bg-emerald-50" : clampedScore >= 5 ? "bg-amber-50" : "bg-red-50";

  return (
    <div className="text-center">
      <div className={`relative w-20 h-20 mx-auto mb-2 rounded-full ${bgColor}`}>
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            className="stroke-muted/40"
            strokeWidth="8"
          />
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            className={ringColor}
            strokeWidth="8"
            strokeDasharray={`${percentage * 2.26} 226`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg font-bold ${scoreColor}`}>{score.toFixed(1)}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {description && (
        <p className="text-[10px] text-muted-foreground/60 mt-0.5 leading-3.5 max-w-[100px] mx-auto">{description}</p>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <BarChart3 className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-muted-foreground">暂无统计数据</h3>
      <p className="text-sm text-muted-foreground/70 mt-1">
        开始创建内容后，数据统计将自动生成
      </p>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}
