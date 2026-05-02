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
  const [timeRange, setTimeRange] = useState("30"); // days

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange, workspaceId]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics?timeRange=${timeRange}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

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
            />
            <SummaryCard
              title="平均质量分"
              value={summary.avgQualityScore.toFixed(1)}
              icon={TrendingUp}
              color="text-green-600"
              bgColor="bg-green-50"
              suffix="/10"
            />
            <SummaryCard
              title="发布成功率"
              value={`${summary.publishSuccessRate}%`}
              icon={CheckCircle}
              color="text-purple-600"
              bgColor="bg-purple-50"
            />
            <SummaryCard
              title="活跃项目"
              value={topProjects.length}
              icon={Users}
              color="text-orange-600"
              bgColor="bg-orange-50"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Content Trend Chart */}
            <ChartCard title="内容生成趋势">
              {visibleContentTrend.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">暂无数据</p>
              ) : (
                <div className="space-y-2">
                  {visibleContentTrend.map((item) => (
                    <div key={item.date} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-20">
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
            <ChartCard title="质量评分趋势">
              {visibleQualityTrend.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">暂无数据</p>
              ) : (
                <div className="space-y-2">
                  {visibleQualityTrend.map((item) => (
                    <div key={item.date} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-20">
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
            <ChartCard title="内容状态分布">
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
            <ChartCard title="平台内容分布">
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
          <ChartCard title="质量评分详情">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <QualityScoreCard
                label="内容质量"
                score={summary.avgQualityScore}
                color="bg-blue-500"
              />
              <QualityScoreCard
                label="吸引力"
                score={summary.avgEngagementScore}
                color="bg-purple-500"
              />
              <QualityScoreCard
                label="品牌调性"
                score={summary.avgBrandVoiceScore}
                color="bg-green-500"
              />
              <QualityScoreCard
                label="平台适配"
                score={summary.avgPlatformFitScore}
                color="bg-orange-500"
              />
            </div>
          </ChartCard>

          {/* Recent Activity & Top Projects */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <ChartCard title="最近内容">
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
            <ChartCard title="活跃项目">
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
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  suffix?: string;
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
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-lg p-4 border border-border">
      <h3 className="text-sm font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

function QualityScoreCard({
  label,
  score,
  color,
}: {
  label: string;
  score: number;
  color: string;
}) {
  const clampedScore = Math.max(0, Math.min(10, score));
  const percentage = (clampedScore / 10) * 100;

  return (
    <div className="text-center">
      <div className="relative w-20 h-20 mx-auto mb-2">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            className="stroke-muted"
            strokeWidth="8"
          />
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            className={color}
            strokeWidth="8"
            strokeDasharray={`${percentage * 2.26} 226`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold">{score.toFixed(1)}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
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
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
