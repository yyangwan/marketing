/**
 * Genie URL Fetcher
 * Phase 1E: Fetches and extracts content from URLs for analysis
 * Uses a simple fetch-based approach since web_reader library is not available
 */

export interface FetchedContent {
  url: string;
  title: string;
  content: string;
  html: string;
  author?: string;
  publishDate?: string;
  images: string[];
  links: string[];
  metadata: Record<string, unknown>;
}

export class URLFetchError extends Error {
  constructor(
    public url: string,
    public reason: string,
    public originalError?: Error
  ) {
    super(`Failed to fetch ${url}: ${reason}`);
    this.name = "URLFetchError";
  }
}

/**
 * Fetches and extracts content from a URL
 */
export async function fetchURL(url: string): Promise<FetchedContent> {
  // Validate URL format
  try {
    new URL(url);
  } catch (e) {
    throw new URLFetchError(url, "Invalid URL format", e as Error);
  }

  try {
    // Simple fetch approach
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Extract title from HTML
    const title = extractTitleFromHTML(html) || extractTitleFromUrl(url);

    // Basic HTML to text conversion
    const content = htmlToText(html);

    // Extract images
    const images = extractImagesFromHTML(html);

    // Extract links
    const links = extractLinksFromHTML(html);

    return {
      url,
      title,
      content,
      html,
      images,
      links,
      metadata: {},
    };
  } catch (e) {
    throw new URLFetchError(
      url,
      (e as Error).message || "Unknown fetch error",
      e as Error
    );
  }
}

/**
 * Extracts title from HTML
 */
function extractTitleFromHTML(html: string): string | null {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) {
    return h1Match[1].trim();
  }

  return null;
}

/**
 * Converts HTML to plain text
 */
function htmlToText(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // Replace common block elements with newlines
  text = text.replace(/<\/(div|p|h[1-6]|li|tr|td)>/gi, "\n");
  text = text.replace(/<(br|hr)\s*\/?>/gi, "\n");

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Clean up whitespace
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

/**
 * Extracts image URLs from HTML
 */
function extractImagesFromHTML(html: string): string[] {
  const images: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    if (src && !src.startsWith("data:")) {
      images.push(src);
    }
  }
  return images;
}

/**
 * Extracts links from HTML
 */
function extractLinksFromHTML(html: string): string[] {
  const links: string[] = [];
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    if (href && (href.startsWith("http") || href.startsWith("/"))) {
      links.push(href);
    }
  }
  return [...new Set(links)]; // Deduplicate
}

/**
 * Extracts title from URL hostname as fallback
 */
function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace("www.", "");
  } catch {
    return "Unknown Source";
  }
}

/**
 * Batch fetch multiple URLs
 */
export async function fetchURLs(urls: string[]): Promise<Map<string, FetchedContent>> {
  const results = new Map<string, FetchedContent>();
  const errors: Map<string, Error> = new Map();

  // Fetch in parallel with concurrency limit
  const concurrencyLimit = 3;
  const chunks = [];
  for (let i = 0; i < urls.length; i += concurrencyLimit) {
    chunks.push(urls.slice(i, i + concurrencyLimit));
  }

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (url) => {
        try {
          const content = await fetchURL(url);
          results.set(url, content);
        } catch (e) {
          errors.set(url, e as Error);
        }
      })
    );
  }

  // If any failed, throw with details
  if (errors.size > 0) {
    const errorMessages = Array.from(errors.entries())
      .map(([url, err]) => `- ${url}: ${err.message}`)
      .join("\n");
    throw new Error(
      `Failed to fetch ${errors.size} URL(s):\n${errorMessages}`
    );
  }

  return results;
}

/**
 * Validates if content is substantial enough for analysis
 */
export function isContentSubstantial(content: FetchedContent): boolean {
  const minContentLength = 200;
  const hasText = content.content.length > minContentLength;
  const hasTitle = content.title.length > 0;
  return hasText && hasTitle;
}
