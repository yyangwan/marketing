/**
 * Analysis Library - Main Export
 *
 * Comprehensive content analysis utilities for SEO and quality assessment.
 * All functions are designed for fast, local execution without external dependencies.
 *
 * Modules:
 * - SEO: keyword density, links, images, meta tags
 * - Readability: Flesch Reading Ease, sentence complexity
 * - Keywords: TF-IDF extraction, bigrams, HTML-weighted extraction
 * - Structure: heading hierarchy, paragraph analysis, TOC generation
 * - Sentiment: emotion detection, polarity scoring (Chinese + English)
 * - Quality: local metrics for instant feedback
 */

// SEO Analysis
export * from './seo';

// Readability Scoring
export * from './readability';

// Keyword Extraction
export * from './keywords';

// Content Structure
export * from './structure';

// Sentiment Analysis
export * from './sentiment';

// Local Quality Metrics
export * from './quality';
