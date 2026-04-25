# Design System — ContentOS

## Product Context
- **What this is:** AI content marketing platform for Chinese agencies. Brief once, generate per-platform, human edit, publish.
- **Who it's for:** Agency content leads managing multi-client content. Editors, writers, and clients who review content.
- **Space/industry:** Chinese content marketing SaaS. Peers: Narrato (international), CopyDone + 蚁小二 (domestic).
- **Project type:** Web app / workspace tool. Daily-driver for content professionals.

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian
- **Decoration level:** Minimal. Typography and spacing do all the work. No decorative borders, background patterns, or gradient accents.
- **Mood:** Serious tool, get out of the way. The content is the visual star. Professional, calm, data-dense. Think Linear, not Notion.
- **Reference products:** Linear (layout density), Notion (editor UX), Trello (kanban convention)

## Typography
- **Display/Hero:** Geist Sans Semibold (600) — clean geometric sans, good for Chinese UI
- **Body:** Geist Sans Regular (400) — highly readable at small sizes
- **UI/Labels:** Geist Sans Medium (500) — nav items, badges, tab labels
- **Data/Tables:** Geist Sans with tabular-nums — Prisma data, status columns
- **Code:** Geist Mono — not used in current UI, available for future
- **Loading:** Self-hosted via `next/font/google` (already configured in layout.tsx)
- **Scale:**

| Level | Size | Weight | Tracking | Usage |
|-------|------|--------|----------|-------|
| 2xl | 24px | 600 | -0.02em | Page titles |
| xl | 20px | 600 | -0.01em | Section headers |
| lg | 16px | 500 | 0 | Card titles, dialog titles |
| base | 14px | 400 | 0 | Body text, form labels |
| sm | 13px | 400 | 0 | Badges, timestamps, meta |
| xs | 12px | 400 | 0 | Platform tags, status labels |

## Color
- **Approach:** Restrained. One accent color. Grays for everything else. Platform colors appear only as functional badges.
- **Primary:** #4F46E5 (indigo-600) — primary actions, active states, focus rings, links
- **Primary foreground:** #FFFFFF — text on primary buttons
- **Secondary:** #F3F4F6 (gray-100) — secondary buttons, hover states
- **Neutrals:**

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| background | #F9FAFB | #111827 | Page background |
| surface | #FFFFFF | #1F2937 | Cards, sidebar, dialogs |
| border | #E5E7EB | #374151 | Borders, dividers |
| text-primary | #111827 | #F9FAFB | Headings, body text |
| text-secondary | #6B7280 | #9CA3AF | Descriptions, meta |
| text-muted | #9CA3AF | #6B7280 | Placeholders, disabled |

- **Platform colors (functional only):**

| Platform | Color | Usage |
|----------|-------|-------|
| 微信公众号 | #16A34A (green-600) | Badge, tab indicator |
| 微博 | #DC2626 (red-600) | Badge, tab indicator |
| 小红书 | #EC4899 (pink-500) | Badge, tab indicator |
| 抖音 | #000000 | Badge, tab indicator |

- **Status colors (kanban columns):**

| Status | Background | Text | Label |
|--------|-----------|------|-------|
| AI 草稿 | #DBEAFE (blue-100) | #1E40AF (blue-800) | draft |
| 人工编辑 | #FEF3C7 (amber-100) | #92400E (amber-800) | editing |
| 客户审核 | #EDE9FE (violet-100) | #5B21B6 (violet-800) | review |
| 已批准 | #DCFCE7 (green-100) | #166534 (green-800) | approved |
| 已发布 | #F3F4F6 (gray-100) | #374151 (gray-800) | published |

- **Semantic:**
  - Success: #16A34A (green-600)
  - Warning: #D97706 (amber-600)
  - Error: #DC2626 (red-600)
  - Info: #2563EB (blue-600)

- **Dark mode strategy:** Redesign surfaces (not just invert). Reduce all chromatic colors by 15% saturation. Keep platform colors unchanged (they're brand colors). Use dark gray surfaces, not pure black.

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable (data-dense but breathable)
- **Scale:**

| Token | Value | Usage |
|-------|-------|-------|
| 2xs | 2px | Icon gaps, badge padding |
| xs | 4px | Inline gaps, tight spacing |
| sm | 8px | Form field gaps, list items |
| md | 12px | Card internal padding |
| lg | 16px | Section padding, form groups |
| xl | 24px | Page section gaps |
| 2xl | 32px | Page header padding |
| 3xl | 48px | Major section breaks |

## Layout
- **Approach:** Grid-disciplined
- **Sidebar:** 240px fixed width, collapsible to hamburger on mobile (<768px)
- **Content area:** Fluid, max-width none (workspace fills available space)
- **Kanban columns:** Equal width, min 220px, horizontal scroll on overflow
- **Editor:** Single column, max-width 720px centered, platform tabs above
- **Border radius:**

| Token | Value | Usage |
|-------|-------|-------|
| sm | 4px | Badges, tags |
| md | 6px | Buttons, inputs |
| lg | 8px | Cards, dialogs |
| xl | 12px | Large containers |
| full | 9999px | Avatar circles |

## Motion
- **Approach:** Minimal-functional. Only transitions that aid comprehension.
- **Easing:** enter `ease-out`, exit `ease-in`, move `ease-in-out`
- **Duration:**
  - micro: 100ms (hover states, focus rings)
  - short: 200ms (tab switches, dropdown open)
  - medium: 300ms (sidebar collapse, toast enter/exit)
  - long: 500ms (page transitions, if added)
- **No scroll animations, no entrance choreography, no decorative motion.**

## Icon System
- **Library:** Lucide React (installed via Shadcn)
- **Usage:** Navigation icons, action buttons, status indicators
- **Size:** 16px inline, 20px standalone
- **No emoji as icons.** Emoji render inconsistently across OS and look unprofessional.

## Component Patterns
- **Toast system:** Sonner (Shadcn ecosystem standard). Success/error/warning/info variants.
- **Editor toolbar:** Minimal row above TipTap editor. Bold, italic, H2, H3, bullet list, ordered list, link.
- **Platform badges:** Chinese short names on colored backgrounds. 微信/微博/小红书/抖音.
- **Kanban cards:** Title, platform badges, status badge, creation date. Hover reveals valid next-status transitions only.
- **Sidebar navigation:** Dynamic active state based on current path. Lucide icons. Hamburger collapse on mobile.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-24 | Initial design system created | Created by /design-consultation after /plan-eng-review + /plan-design-review. 12 prior decisions integrated. |
| 2026-04-24 | Single font family (Geist) | Unifies the UI. Geist has 9 weights and tabular figures. Less "designed" feel. |
| 2026-04-24 | Indigo-600 as primary accent | Professional, pairs well with platform colors. Tokenized in CSS variables. |
| 2026-04-24 | Chinese platform names | Instantly recognizable to Chinese users. Single letters (W/B/X/D) were unrecognizable. |
| 2026-04-24 | Lucide icons replacing emoji | Consistent sizing, professional appearance. Emoji render differently across OS. |
| 2026-04-24 | Sonner for toasts | Shadcn ecosystem standard. Replaces alert() calls. |
| 2026-04-24 | Minimal decoration | Content is the visual star. Tool chrome should disappear. |
