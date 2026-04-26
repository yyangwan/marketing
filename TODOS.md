# ContentOS TODOs

## Phase 1D — Workflow + Calendar (DEFERRED)

### TODO: Calendar View Implementation
**What:** Build monthly/weekly calendar view showing scheduled content as cards with drag-and-drop rescheduling.

**Why:** Turns ContentOS from occasional use into daily operations hub. Users need to see when content is scheduled.

**Pros:**
- Visual planning becomes possible
- Users can see content gaps
- Drag-and-drop is intuitive UX

**Cons:**
- Complex calendar UI (~2-3 days work)
- Drag-and-drop state management complexity
- Needs collision handling for overlapping items

**Context:** Phase 1C ships first. Once users have brand voice and templates working, calendar becomes the next logical upgrade. Calendar depends on ContentSchedule model from Phase 1D.

**Depends on:** Phase 1C complete, ContentSchedule Prisma model

---

### TODO: Scheduling System
**What:** Background cron job that checks for due content and triggers publishing (mock in 1D, real in 1F).

**Why:** Users want to schedule content in advance and have it publish automatically.

**Pros:**
- Users can batch create content
- Set-and-forget workflow
- Enables "always-on" content operations

**Cons:**
- Cron infrastructure needed (Vercel Cron or external)
- Failure handling for publish failures
- Timezone complexity

**Context:** Phase 1D uses mock publishing. Real publishing comes in Phase 1F. The scheduling infrastructure (cron + status tracking) is built in 1D and reused in 1F.

**Depends on:** Calendar view, ContentSchedule model, cron infrastructure

---

### TODO: Notification System
**What:** Real-time notifications for content status changes, schedule reminders, @mentions.

**Why:** Users need to know when content is approved, scheduled, or published. Keeps teams aligned.

**Pros:**
- Better team collaboration
- Reduced manual status checking
- Urgent content gets attention

**Cons:**
- Notification bell UI component
- Real-time delivery complexity (polling vs websockets)
- Notification preferences needed

**Context:** Notification Prisma model defined in Phase 1D. UI: bell icon in sidebar, dropdown list, mark-all-read action.

**Depends on:** Phase 1D complete, real-time infrastructure

---

## Phase 1E — Genie Auto-Content Factory (DEFERRED)

### TODO: URL Analysis Engine
**What:** Fetch and analyze a source URL to extract business type, key products, brand tone, target audience, recurring topics.

**Why:** Genie needs to understand a website before generating relevant content.

**Pros:**
- Zero-configuration setup (just paste URL)
- AI extracts insights humans might miss
- Enables "set and forget" content generation

**Cons:**
- Server-side URL fetching needed
- HTML parsing complexity (sites vary wildly)
- AI analysis cost per URL

**Context:** GenieSource Prisma model stores extracted metadata. Analysis is on-demand only (manual trigger) in Phase 1E. Periodic re-analysis deferred to later phase.

**Depends on:** Phase 1C complete, GenieSource model, URL fetcher

---

### TODO: Auto-Generation Pipeline
**What:** Weekly cron job that generates 3-5 content ideas per source, creates ContentPieces with "genie_draft" status for user review.

**Why:** The "never-sleeps content operator." Users get weekly content suggestions without lifting a finger.

**Pros:**
- Continuous content flow
- No manual ideation needed
- Leverage existing brand voice + templates

**Cons:**
- Cron infrastructure complexity
- Genie drafts need review UI
- Risk of low-quality suggestions wasting user time

**Context:** New "genie_draft" status value. Genie drafts appear in dedicated panel, NOT in main kanban. One-click approve/reject flow.

**Depends on:** URL Analysis Engine, Phase 1C (brand voice), cron infrastructure

---

## Phase 1F — Real Publishing Integration (DEFERRED)

### TODO: WeChat Official Account API Integration
**What:** OAuth flow + draft API + publish API + media upload for WeChat Official Accounts.

**Why:** One-click publish to WeChat. No more copy-paste.

**Pros:**
- Native publishing, final integration step
- Publish status tracking
- Published URLs captured automatically

**Cons:**
- OAuth 2.0 flow complexity
- Platform API rate limits
- Developer account approval needed (could take weeks)

**Context:** WeChat requires verified service account. Draft API: create → submit → publish. Media upload for images. Error handling for rate limits and API failures.

**Depends on:** Phase 1D scheduling, PlatformConnection Prisma model, WeChat developer account

---

### TODO: Weibo Publishing Integration
**What:** OAuth + post API for Weibo. Text + images. Character limits: 2000 (normal) / 140 (classic).

**Why:** Complete the publishing loop for Weibo content.

**Pros:**
- Native Weibo publishing
- Hashtag and @mention support
- Image upload support

**Cons:**
- OAuth complexity
- Character limit handling (2 modes)
- Rate limits per account type

**Context:** Weibo Open Platform API. Post API supports text + images. Hashtag format: #话题#. @mention format: @用户名.

**Depends on:** PlatformConnection model, Weibo developer account

---

### TODO: Xiaohongshu (XHS) Publishing Integration
**What:** Note creation API for XHS. Title + body + images + tags. Content review before publishing.

**Why:** Complete the publishing loop for XHS content.

**Pros:**
- Native XHS publishing
- Format-optimized content
- Captures growing XHS audience

**Cons:**
- API access may require partnership
- Fallback to browser automation (Playwright) if API blocked
- Content review adds friction

**Context:** XHS Creator API has limited access. Alternative: XHS Business Platform API. Risk mitigation: if API unavailable, use Playwright browser automation or one-click "copy formatted" button.

**Depends on:** PlatformConnection model, XHS API availability verification

---

### TODO: Publishing Dashboard UI
**What:** Platform connection management, publishing status indicators, history log, failed publish retry.

**Why:** Users need to see what's connected, what's publishing, and what failed.

**Pros:**
- Publishing status transparency
- Easy retry for failed publishes
- Connection health monitoring

**Cons:**
- Settings page complexity (/settings/publishing)
- Real-time status updates needed
- Error message display for failures

**Context:** Status states: "Not connected" / "Connected" / "Publishing..." / "Published". Failed publishes show error message + retry button.

**Depends on:** Individual platform integrations (WeChat/Weibo/XHS)

---

## Infrastructure & Tooling

### TODO: Migration to PostgreSQL
**What:** Migrate from SQLite (dev) to PostgreSQL (production-ready). Update Prisma config, handle data migration.

**Why:** SQLite is fine for local dev but not for production multi-tenant SaaS. PostgreSQL handles concurrent access better.

**Pros:**
- Production-ready database
- Better concurrency
- Full-text search capabilities
- JSON query support

**Cons:**
- Data migration complexity
- Hosting cost (managed Postgres)
- Schema differences to handle

**Context:** Current schema uses Prisma with SQLite adapter (@prisma/adapter-better-sqlite3). Migration needed before production launch. Can use Prisma migrate for schema sync.

**Depends on:** Production deployment planning

---

### TODO: CI/CD Pipeline Setup
**What:** GitHub Actions workflow for tests, linting, type-checking on PR. Auto-deploy on merge to main.

**Why:** Ensure quality before deploy. Automate deployment process.

**Pros:**
- Catches bugs before production
- Consistent deployment process
- Rollback capability

**Cons:**
- Initial setup complexity
- GitHub Actions configuration maintenance
- Deployment secrets management

**Context:** Run `bun test`, `bun run lint`, `bun run typecheck` on PR. Deploy to Vercel on merge to main branch.

**Depends on:** Test framework setup (Vitest), linting setup, TypeScript strict mode

---

## Product & UX

### TODO: User Onboarding Flow
**What:** Guided tour for new users. Highlights key features: create project, generate content, use brand voice.

**Why:** Reduces friction for new users. Increases activation rate.

**Pros:**
- Faster time-to-value
- Reduced support burden
- Higher feature discovery

**Cons:**
- Onboarding UI complexity
- Need skip option for experienced users
- Maintenance as product evolves

**Context:** First-time users see a guided tour. Steps: create workspace → create project → create brand voice (optional) → generate first content.

**Depends on:** Phase 1C complete (brand voice feature exists)

---

### TODO: Analytics Dashboard
**What:** Dashboard showing content generation stats, quality trends, publishing success rates, team activity.

**Why:** Users need visibility into content operations. Track what's working.

**Pros:**
- Data-driven decisions
- Team productivity visibility
- ROI measurement

**Cons:**
- Dashboard UI complexity
- Analytics aggregation queries (could be slow)
- Privacy concerns (team member activity)

**Context:** Metrics: content generated this week, average quality score, publishing success rate, most active team members. Charts for trends.

**Depends on:** Phase 1C complete (quality data available), Phase 1F complete (publishing data available)

---

## Platform-Specific

### TODO: Douyin Script to Video Conversion
**What:** Generate video from script (text-to-video) or provide production guidance for creators.

**Why:** Douyin scripts are useless without actual video. Gap between script and final publishable content.

**Pros:**
- Completes the Douyin workflow
- Enables actual Douyin publishing
- Differentiator from competitors

**Cons:**
- Text-to-video is complex/expensive
- Alternative: production guidance is simpler but less automated
- Video editing needed regardless

**Context:** Douyin is included in Phase 1C for script generation only. Publishing is deferred. Video creation is out of scope for 1C-1F. Could use AI video APIs (Runway, HeyGen) or provide manual production guidance.

**Depends on:** Phase 1C complete (Douyin scripts), Phase 1F complete (Douyin publishing)

---

## Design & Polish

### TODO: Mobile Responsive Design
**What:** Ensure all pages work on mobile. Dashboard, content editor, calendar view, settings.

**Why:** Content creators work on phones. Mobile is not optional.

**Pros:**
- Users can work anywhere
- Larger addressable market
- Better UX for tablet users

**Cons:**
- Responsive design complexity
- Mobile-specific UI patterns needed
- Testing on multiple devices

**Context:** Current design is desktop-focused. Priority pages: dashboard (view content), content editor (make quick edits), calendar (view schedule). Settings can be desktop-only initially.

**Depends on:** Design system established, Phase 1C complete

---

## Integrations

### TODO: Slack/DingTalk Integration
**What:** Post notifications to Slack or DingTalk when content is approved, published, or needs review.

**Why:** Teams use these tools for communication. In-app notifications may be missed.

**Pros:**
- Meets users where they are
- Faster response times
- Reduced email clutter

**Cons:**
- OAuth complexity per platform
- Webhook delivery reliability
- Rate limits per platform

**Context:** Webhook URL per workspace. Events: content_approved, content_published, content_review_needed. Message format: platform-appropriate (Slack blocks, DingTalk cards).

**Depends on:** Notification system (Phase 1D), workspace webhook settings UI
