# ContentOS TODOs

## Completed

### ✅ Calendar View Implementation
**Completed:** v0.3.0 (2026-04-26)

### ✅ Scheduling System
**Completed:** v0.3.0 (2026-04-26)

### ✅ Notification System
**Completed:** v0.3.0 (2026-04-26)

### ✅ Analytics Dashboard
**Completed:** v0.3.3 (2026-05-01)

### ✅ WeChat / Weibo / Xiaohongshu Publishing Integration
**Completed:** v0.3.4 (2026-05-01)

### ✅ Publishing Dashboard UI
**Completed:** v0.3.4 (2026-05-01)

### ✅ Migration to PostgreSQL
**What:** Migrate from SQLite to PostgreSQL with @prisma/adapter-pg.
**Completed:** v0.4.0 (2026-05-04)

### ✅ CI/CD Pipeline Setup
**What:** GitHub Actions — lint, typecheck, test, build, deploy to Alibaba Cloud ECS.
**Completed:** v0.4.0 (2026-05-04)

---

## Product & UX

### TODO: User Onboarding Flow
**What:** Guided tour for new users. Highlights key features: create project, generate content, use brand voice.

**Why:** Reduces friction for new users. Increases activation rate.

**Context:** First-time users see a guided tour. Steps: create workspace → create project → create brand voice (optional) → generate first content.

**Depends on:** ✅ All phases complete

---

## Design & Polish

### TODO: Mobile Responsive Design
**What:** Ensure all pages work on mobile. Dashboard, content editor, calendar view, settings.

**Why:** Content creators work on phones. Mobile is not optional.

**Context:** Current design is desktop-focused. Priority pages: dashboard (view content), content editor (make quick edits), calendar (view schedule). Settings can be desktop-only initially.

**Depends on:** ✅ All phases complete

---

## Integrations

### TODO: Slack/DingTalk Integration
**What:** Post notifications to Slack or DingTalk when content is approved, published, or needs review.

**Why:** Teams use these tools for communication. In-app notifications may be missed.

**Context:** Webhook URL per workspace. Events: content_approved, content_published, content_review_needed.

**Depends on:** ✅ Notification system (Phase 1D)

---

## Platform-Specific

### TODO: Douyin Script to Video Conversion
**What:** Generate video from script (text-to-video) or provide production guidance for creators.

**Why:** Douyin scripts are useless without actual video. Gap between script and final publishable content.

**Context:** Could use AI video APIs (Runway, HeyGen) or provide manual production guidance.

**Depends on:** ✅ Phase 1C + 1F complete

---

## Deferred

### TODO: Genie Auto-Content Factory
- **URL Analysis Engine:** Fetch and analyze a source URL to extract business type, key products, brand tone, target audience.
- **Auto-Generation Pipeline:** Weekly cron that generates 3-5 content ideas per source for user review.

**Context:** GenieSource Prisma model stores extracted metadata. New "genie_draft" status. Dedicated review panel (NOT in main kanban).

**Depends on:** ✅ Phase 1C (brand voice), cron infrastructure
