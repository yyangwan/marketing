"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  TrendingUp,
  CheckCircle,
  Users,
  BarChart3,
  Calendar,
} from "lucide-react";

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

const PLATFORM_LABELS: Record<string, string> = {
  wechat: "微信",
  weibo: "微博",
  xiaohongshu: "小红书",
  douyin: "抖音",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  reviewing: "审核中",
  approved: "已通过",
  published: "已发布",
  scheduled: "已排期",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  reviewing: "bg-yellow-100 text-yellow-700",
  approved: "bg-blue-100 text-blue-700",
  published: "bg-green-100 text-green-700",
  scheduled: "bg-purple-100 text-purple-700",
};

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

  // Calculate max values for bar charts
  const maxContentCount = Math.max(
    ...trends.contentOverTime.map((d) => d.count),
    1
  );
  const maxQualityScore = 10;

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
          <div className="space-y-2">
            {trends.contentOverTime.map((item) => (
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
        </ChartCard>

        {/* Quality Trend Chart */}
        <ChartCard title="质量评分趋势">
          <div className="space-y-2">
            {trends.qualityOverTime.map((item) => (
              <div key={item.date} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-20">
                  {formatDate(item.date)}
                </span>
                <div className="flex-1 h-8 bg-muted rounded overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{
                      width: `${(item.score / maxQualityScore) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium w-8 text-right">
                  {item.score.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <ChartCard title="内容状态分布">
          <div className="space-y-3">
            {Object.entries(distributions.byStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[status] || "bg-gray-100"}`}
                  >
                    {STATUS_LABELS[status] || status}
                  </span>
                </div>
                <span className="text-sm font-medium">{count}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Platform Distribution */}
        <ChartCard title="平台内容分布">
          <div className="space-y-3">
            {Object.entries(distributions.byPlatform).map(([platform, count]) => (
              <div key={platform} className="flex items-center justify-between">
                <span className="text-sm">
                  {PLATFORM_LABELS[platform] || platform}
                </span>
                <span className="text-sm font-medium">{count}</span>
              </div>
            ))}
          </div>
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
          <div className="space-y-2">
            {recentActivity.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.projectName}
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-xs ml-2 ${STATUS_COLORS[item.status] || "bg-gray-100"}`}
                >
                  {STATUS_LABELS[item.status] || item.status}
                </span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Top Projects */}
        <ChartCard title="活跃项目">
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
        </ChartCard>
      </div>
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
