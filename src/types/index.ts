export type Platform = "wechat" | "weibo" | "xiaohongshu" | "douyin";

export type ContentStatus = "draft" | "genie_draft" | "editing" | "review" | "approved" | "published";

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

  // New AI scores
  sentiment?: number;  // -10 to 10 converted to 0-10 scale
  topicConsistency?: number;  // 0-10
  originality?: number;  // 0-10

  // Local metrics (computed, not from AI)
  localMetrics?: LocalQualityMetrics;

  // Historical tracking
  previousScores?: string;  // JSON: store previous evaluation for comparison
  evaluationCount?: number;  // Track how many times evaluated
}

// Local quality metrics computed instantly
export interface LocalQualityMetrics {
  readabilityScore: number;  // 0-100 Flesch Reading Ease
  vocabularyDiversity: number;  // 0-1 unique words / total words
  sentenceComplexity: number;  // avg words per sentence
  consistencyScore: number;  // 0-100 style consistency
}

// Sentiment analysis
export interface SentimentAnalysis {
  overall: "positive" | "neutral" | "negative";
  score: number;  // -1 to 1
  confidence: number;  // 0-1
}

// Quality history entry
export interface QualityHistoryEntry {
  id: string;
  contentPieceId: string;
  quality: number;
  engagement: number;
  brandVoice: number;
  platformFit: number;
  sentiment?: number;
  topicConsistency?: number;
  originality?: number;
  contentHash: string;
  evaluatedAt: Date;
}

// Extended SEO analysis types
export interface SEOAnalysisExtended {
  // Existing fields
  characterCount: number;
  wordCount: number;
  keywordDensity: KeywordMetric[];
  overallScore: number;

  // New fields
  readabilityScore: number;  // 0-100, Flesch Reading Ease
  readabilityLevel: ReadabilityLevel;
  structure: StructureAnalysis;
  links: LinkAnalysis;
  images: ImageAnalysis;
  extractedKeywords: ExtractedKeyword[];
}

export type ReadabilityLevel = "easy" | "medium" | "hard" | "very-hard";

export interface KeywordMetric {
  keyword: string;
  count: number;
  density: number;
  rating: "good" | "low" | "stuffed";
}

export interface ExtractedKeyword {
  keyword: string;
  relevance: number;  // 0-1 TF-IDF score
  frequency: number;
}

export interface StructureAnalysis {
  hasH1: boolean;
  h1Count: number;
  headingHierarchy: string[];  // ["H1", "H2", "H2", "H3"]
  paragraphCount: number;
  averageParagraphLength: number;
  longParagraphs: number;  // paragraphs > 150 words
  structureScore: number;  // 0-100
}

export interface LinkAnalysis {
  internalLinks: number;
  externalLinks: number;
  totalLinks: number;
  linkDensity: number;  // links per 100 words
  brokenLinks: string[];  // URLs that appear broken
}

export interface ImageAnalysis {
  totalImages: number;
  imagesWithAlt: number;
  imagesWithoutAlt: number;
  altCoverage: number;  // percentage
}

// Stop words for keyword extraction (Chinese + English)
export const STOP_WORDS_ZH = new Set([
  "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都", "一", "一个",
  "上", "也", "很", "到", "说", "要", "去", "你", "会", "着", "没有", "看", "好",
  "自己", "这", "那", "里", "就是", "为", "这个", "那个", "什么", "可以", "还",
  "已经", "如果", "这些", "那些", "这样", "那样", "因为", "所以", "但是", "然后"
]);

export const STOP_WORDS_EN = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for",
  "not", "on", "with", "he", "as", "you", "do", "at", "this", "but", "his", "by",
  "from", "they", "we", "say", "her", "she", "or", "an", "will", "my", "one", "all",
  "would", "there", "their", "what", "so", "up", "out", "if", "about", "who", "get",
  "which", "go", "me", "when", "make", "can", "like", "time", "no", "just", "him",
  "know", "take", "people", "into", "year", "your", "good", "some", "could", "them",
  "see", "other", "than", "then", "now", "look", "only", "come", "its", "over", "think",
  "also", "back", "after", "use", "two", "how", "our", "work", "first", "well", "way",
  "even", "new", "want", "because", "any", "these", "give", "day", "most", "us"
]);

// Phase 1D: Scheduling & Notifications
export type ScheduleStatus = "scheduled" | "publishing" | "published" | "failed";

export type NotificationType =
  | "content_review"
  | "content_approved"
  | "content_published"
  | "schedule_reminder"
  | "mention";

export interface ContentSchedule {
  id: string;
  contentId: string;
  scheduledAt: Date;
  publishedAt: Date | null;
  status: ScheduleStatus;
  createdAt: Date;
  contentPiece?: {
    id: string;
    title: string;
    platform?: string;
  };
}

export interface Notification {
  id: string;
  userId: string;
  workspaceId: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: Date;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;  // ISO datetime string
  end?: string;
  contentId: string;
  platform?: string;
  status: ScheduleStatus;
}

/* DESIGN.md status colors */
export const STATUS_COLUMNS: { key: ContentStatus; label: string; color: string }[] = [
  { key: "draft", label: "AI 草稿", color: "bg-blue-100 text-blue-800" },
  { key: "genie_draft", label: "Genie 生成", color: "bg-purple-100 text-purple-800" },
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
