export type Platform = "wechat" | "weibo" | "xiaohongshu" | "douyin";

export type ContentStatus = "draft" | "editing" | "review" | "approved" | "published";

export type ContentType = "blog_post" | "social_post" | "video_script";

export interface Brief {
  topic: string;
  keyPoints: string[];
  platforms: Platform[];
  references: string;
  notes: string;
}

// Phase 1C: Brand Voice System
export interface BrandVoice {
  id: string;
  name: string;
  workspaceId: string;
  description: string | null;
  guidelines: string | null;  // Dos and don'ts for tone
  samples: string;  // JSON array of sample content strings
  createdAt: Date;
  updatedAt: Date;
}

export type TemplateVariableType = "text" | "number" | "textarea";

export interface TemplateVariable {
  name: string;  // Variable name (alphanumeric + underscore only)
  type: TemplateVariableType;
  description: string;
  required: boolean;
}

export interface AITemplate {
  id: string;
  name: string;
  workspaceId: string;
  description: string | null;
  template: string;  // Template content with {variable} placeholders
  variables: TemplateVariable[];  // JSON array
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentQuality {
  id: string;
  contentPieceId: string;
  quality: number;  // 0-10
  engagement: number;  // 0-10
  brandVoice: number;  // 0-10
  platformFit: number;  // 0-10
  suggestions: string | null;  // JSON array
  evaluatedAt: Date;
}

/* DESIGN.md status colors */
export const STATUS_COLUMNS: { key: ContentStatus; label: string; color: string }[] = [
  { key: "draft", label: "AI 草稿", color: "bg-blue-100 text-blue-800" },
  { key: "editing", label: "人工编辑", color: "bg-amber-100 text-amber-800" },
  { key: "review", label: "客户审核", color: "bg-violet-100 text-violet-800" },
  { key: "approved", label: "已批准", color: "bg-green-100 text-green-800" },
  { key: "published", label: "已发布", color: "bg-gray-100 text-gray-800" },
];

/* DESIGN.md platform colors — tinted badge style (no solid bg) */
export const PLATFORM_CONFIG: Record<Platform, { label: string; badgeColor: string }> = {
  wechat: { label: "微信", badgeColor: "bg-green-600/10 text-green-600" },
  weibo: { label: "微博", badgeColor: "bg-red-600/10 text-red-600" },
  xiaohongshu: { label: "小红书", badgeColor: "bg-pink-500/10 text-pink-500" },
  douyin: { label: "抖音", badgeColor: "bg-black/6 text-black" },
};
