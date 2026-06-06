# Design System

## Overview

ContentOS is a clean, professional SaaS dashboard for AI-powered content marketing. The visual identity is minimalist and functional — light gray backgrounds with white cards, anchored by an indigo (`#4F46E5`) accent color. The layout uses a kanban-style board with 10 workflow columns representing the content lifecycle from AI draft to published. Typography is restrained (Geist sans-serif) with monospace accents for labels. The overall feel is efficient, modern, and task-oriented — designed for marketing teams who need clarity over decoration.

## Colors

- **Primary Brand**: `#4F46E5` — Indigo accent for active states, buttons, links, and chart highlights
- **Dark Text**: `#111827` — Near-black for headings and primary content
- **Surface Background**: `#F9FAFB` — Cool light gray for page backgrounds
- **Card Surface**: `#FFFFFF` — Pure white for cards and elevated containers
- **Muted Text**: `#6B7280` — Medium gray for secondary text and empty states
- **Border Quiet**: `#E5E7EB` — Soft gray for card borders and dividers
- **Success Green**: `#16A34A` — Published/approved states
- **Warning Amber**: `#D97706` — Scheduled/pending states
- **Info Blue**: `#2563EB` — Links and informational accents
- **Error Red**: `#DC2626` — Failed states and destructive actions

## Typography

- **Sans-Serif**: Geist (variable 100-900). Primary font for all UI text, headings, and body copy. Clean neo-grotesque with tight spacing.
- **Monospace**: Geist Mono (variable 400-600). Labels, status badges, tags, and technical identifiers. Used for kanban column headers.
- **Serif**: Times New Roman (400, 500, 600). Occasional use for editorial or brand voice content.

## Elevation

- **Cards**: White surfaces on light gray background create depth through color contrast alone. No drop shadows on default state — borders define boundaries.
- **Borders**: 1px solid `#E5E7EB` for card edges. Subtle, non-competing.
- **Hover States**: Slight elevation or background color shift on interactive elements.
- **Sidebar**: Fixed left navigation with white background and indigo active indicators.

## Components

- **Kanban Columns**: 10 vertical swim lanes with header badges showing item count. Each column represents a workflow stage (AI Draft → Published). Dashed-border empty states with "暂无内容" placeholder.
- **Content Cards**: Compact cards within columns showing title, platform icon, quality score, and status indicator.
- **Brief Form**: Multi-step form for creating content briefs with topic, key points, platform selection, brand voice, and reference material inputs.
- **Rich Text Editor**: TipTap-based editor with toolbar for formatting content, AI suggestions panel, and real-time quality scoring sidebar.
- **Analytics Dashboard**: Stat cards with large numbers, trend charts (line/bar), platform distribution donut chart, and quality breakdown bars.
- **Brand Voice Panel**: Voice definition cards with sample text, guidelines, and consistency score visualization.
- **Platform Badges**: Color-coded labels for WeChat (green), Weibo (red), Xiaohongshu (pink), Douyin (black) content targets.
- **Review Share Links**: Shareable URL cards with expiration timer and approval/rejection status.

## Do's and Don'ts

### Do's

- Use the indigo accent sparingly — it should highlight, not dominate
- Keep generous whitespace between kanban columns
- Use color-coded platform badges to differentiate content targets at a glance
- Show data prominently — large stat numbers, clear quality scores, visible trend arrows
- Maintain the light, airy feel — white cards on light gray, thin borders

### Don'ts

- Do not use heavy drop shadows — flat surfaces with borders define the hierarchy
- Do not mix warm and cool tones outside the defined palette
- Do not crowd the kanban — each column should breathe
- Do not use decorative gradients — the brand is clean and functional
