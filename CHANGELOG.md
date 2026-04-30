# Changelog

All notable changes to ContentOS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.com/spec/v2.0.0.html).

## [0.3.1.0] - 2026-04-27

### Changed
- **Calendar Library Migration**: Replaced Schedule-X with react-big-calendar for improved drag-and-drop and week view performance
  - Drag-and-drop rescheduling now works smoothly without lag
  - Week view renders efficiently with realistic content loads
  - Event cards display with platform-specific color coding
  - Click-to-edit navigation from calendar events to content editor

### Added
- **Content API**: New `/api/content` endpoint for fetching content with filters
  - Filter by workspace, project, status, and scheduling status
  - Support for unscheduled content queries
  - Platform and schedule data included in response

### Fixed
- Removed duplicate interface and constant definitions in calendar component
- Fixed event revert logic after failed drag-and-drop operations
- Fixed props shadowing issue in event wrapper component
- Improved type safety by removing `any` types from API route

### Test
- Added E2E test suite for calendar interactions (18 test cases)
- Added unit tests for content API endpoint

### Added
- **Calendar System**: Full calendar UI for managing content publication schedules
  - Calendar card component showing scheduled content with color-coded status indicators
  - Calendar client with month navigation and status filtering
  - Schedule dialog for creating and modifying publication dates
  - Date utility functions for calendar operations (getMonthRange, getWeekRange, formatDateString)
- **Scheduling System**: Content scheduling with automatic cron job publishing
  - Database model `ContentSchedule` with unique constraint per content piece
  - Schedule CRUD APIs at `/api/content/[id]/schedule`
  - Atomic upsert operations to prevent duplicate schedules from race conditions
  - Status workflow: scheduled → publishing → published/failed
  - Cron endpoint `/api/cron/publish` for automatic content publishing
  - Sequential processing with status transitions to prevent concurrent cron job conflicts
- **Notifications System**: Real-time notifications for content events
  - Database model `Notification` with user/workspace associations
  - Notification APIs at `/api/notifications` and `/api/notifications/[id]/read`
  - Notification bell component with unread count indicator
  - Notification dropdown with real-time updates (30s polling)
  - Notification item component with action buttons (mark as read, delete)
  - Notification trigger functions for common events (content_review, schedule_reminder, content_published)
  - Notifications integrated with scheduling and publishing workflows
- **Quality and SEO**: Content quality evaluation and SEO analysis
  - Quality panel component with 4-dimensional scoring (quality, engagement, brand voice, platform fit)
  - SEO scorer component with character count, word count, and keyword density analysis
  - Quality evaluation API at `/api/content/[id]/quality`

### Changed
- App layout now includes notification bell in header
- Main content page updated to display scheduled content with calendar integration
- Status enum expanded to include scheduled/publishing/published/failed states

### Fixed
- Race condition in schedule creation (TOCTOU) resolved with atomic upsert
- Concurrent cron job processing prevented with sequential findFirst pattern
- Missing "publishing" status filter added to calendar UI

## [0.3.2.0] - 2026-04-30

### Added
- **Navigation Component**: New navigation sidebar with active state highlighting
  - Main navigation items (calendar, scheduled, unscheduled, templates)
  - Project list with direct access to each project
  - Visual indicator for currently active page
  - Empty state handling when no projects exist
- **Test Coverage**: Comprehensive unit tests for Navigation and notification-bell components
  - Navigation tests (150+ lines) covering main nav, projects, empty states
  - Notification-bell tests (280+ lines) covering fetching, polling, dropdown, mark-as-read

### Fixed
- **User-Facing Error Messages**: Added toast notifications for all API error scenarios
  - Calendar operations (fetch, unschedule, drop) now show clear error messages on failure
  - Notification operations (fetch, mark-as-read) provide user feedback
  - Unscheduled panel shows error messages on failed operations
- **Test Regression**: Updated calendar events tests to match new query structure
- **Notification Dropdown**: Improved positioning to center above bell icon

### Changed
- **Calendar API Optimization**: Moved filtering from JavaScript to database level
  - Project and status filters now applied at database level for better performance
  - Reduced data transfer and client-side processing
- **Layout Performance**: Parallelized workspace and project queries in root layout
  - Page load time improved with concurrent database queries
  - Uses Promise.all for independent data fetching
- **Event-Driven Refresh**: Added custom event system for cross-component communication
  - Unscheduled panel refreshes immediately when content is scheduled via calendar
  - CUSTOM_EVENTS constant for standardized event names

## [0.3.1.0] - 2026-04-27

### Added
- **Brand Voice System**: Create and manage brand voices with custom samples, guidelines, and descriptions
  - Brand voice CRUD APIs at `/api/brand-voices`
  - Settings page for brand voice management at `/settings/brand-voice`
  - Brand voice injection into all 4 platform prompts (WeChat, Weibo, Xiaohongshu, Douyin)
  - Per-project and per-content brand voice selection with fallback logic
- **Template Management**: Create reusable AI content templates with variable placeholders
  - Template CRUD APIs at `/api/templates`
  - Template management UI at `/templates`
  - Auto-detection of `{variable}` placeholders in template content
  - Variable type validation (text, number, textarea) with format restrictions
- **Content Quality Evaluation**: AI-powered quality scoring for generated content
  - Quality evaluation API at `/api/content/[id]/quality` with 4-dimensional scoring
  - Quality panel component showing overall quality, engagement, brand voice match, and platform fit
  - Brand voice context injection into quality evaluation prompts
  - AI-generated improvement suggestions
- **SEO Analysis**: Built-in SEO scoring for content
  - SEO scorer component with character count, word count, and keyword density analysis
  - Real-time keyword tracking and density calculation
  - Overall SEO score display
- **Content Editor Integration**: SEO scorer and quality panel embedded in content editor
- **Data Models**: BrandVoice, AITemplate, and ContentQuality models in Prisma schema
- **TypeScript Types**: BrandVoice, AITemplate, ContentQuality, and TemplateVariable interfaces

### Changed
- AI generation API now supports brand voice context for all platforms
- Content pieces and projects can have associated brand voices
- Platform content generation uses brand voice from content piece or falls back to project default

### Fixed
- Added defensive error handling for JSON parsing in prompt builders (try-catch with fallback)
- Vitest test infrastructure improvements with jsdom environment and setup file

## [0.1.0] - 2026-04-26

### Added
- Initial release of ContentOS
- Multi-tenant workspace support
- Project-based content organization
- AI-powered content generation for Chinese social platforms
  - 微信公众号 (WeChat)
  - 微博 (Weibo)
  - 小红书 (Xiaohongshu)
  - 抖音 (Douyin)
- Kanban-style content review workflow
- User authentication with NextAuth v5
- Team collaboration with role-based access control
- Rich text editor with TipTap

### Security
- Password hashing with bcrypt
- Session-based authentication
- Workspace-level data isolation

---

## Versioning Policy

### Semantic Versioning

ContentOS follows [Semantic Versioning](https://semver.org/):

- **MAJOR**: Incompatible API changes
- **MINOR**: Backwards-compatible functionality additions
- **PATCH**: Backwards-compatible bug fixes

Example: `1.2.3`
- `1` = MAJOR version
- `2` = MINOR version
- `3` = PATCH version

### Release Types

#### Major Release (Breaking Changes)

When introducing breaking changes:

1. **Announce early**: Document in `[Unreleased]` section with `[BREAKING]` tag
2. **Provide migration guide**: Step-by-step instructions in CHANGELOG
3. **Support old version**: At least 6 months overlap before deprecation
4. **Offer codemod**: Automated migration script when possible

Example entry:
```markdown
## [2.0.0] - 2024-XX-XX

### Added
- New structured error format with error codes

### Changed
- [BREAKING] API errors now return `{error: {type, code, message}}` instead of `{error: string}`
- [BREAKING] `/api/briefs` now requires `projectId` in request body

### Migration
See migration guide below for automated codemod.

### Deprecated
- Old error format deprecated in 1.x, removed in 2.0
```

#### Minor Release (New Features)

New features are backwards-compatible:

```markdown
## [1.1.0] - 2024-XX-XX

### Added
- Support for Xiaohongshu platform
- Bulk content export feature
```

#### Patch Release (Bug Fixes)

Bug fixes are backwards-compatible:

```markdown
## [1.0.1] - 2024-XX-XX

### Fixed
- Fixed session timeout issue after 30 minutes
- Fixed Chinese character encoding in content export
```

### Deprecation Process

1. **Announce**: Add `[Deprecated]` tag in CHANGELOG
2. **Warn**: Add runtime warning in code
3. **Wait**: At least one minor version (6 months)
4. **Remove**: In next major version

Example:
```markdown
## [1.2.0] - 2024-XX-XX

### Added
- New error format with error codes

### Deprecated
- Old error format `{error: string}` deprecated in 1.2, will be removed in 2.0
```

### Migration Guides

For breaking changes, provide migration guides:

#### Migration: 1.x → 2.0

##### Error Format Update

**Before:**
```typescript
const res = await fetch("/api/briefs", ...);
const data = await res.json();
if (data.error) {
  console.log(data.error);
}
```

**After:**
```typescript
const res = await fetch("/api/briefs", ...);
if (!res.ok) {
  const data = await res.json();
  const { type, code, message, doc_url } = data.error;
  console.log(`${code}: ${message}`);
  if (doc_url) console.log(`Learn more: ${doc_url}`);
}
```

##### Automated Migration

```bash
# Install codemod CLI
npx @contentos/codemod@latest migrate-error-format ./src
```

### API Versioning

Current API version: `v1`

Specify version via request header:
```typescript
fetch("/api/briefs", {
  headers: {
    "ContentOS-API-Version": "v1"
  }
});
```

Version pinning rules:
- First API call pins account to that version
- New versions must be explicitly requested via header
- Breaking changes require new major version (v2)
- Old versions supported for at least 12 months

### Release Checklist

Before each release:

- [ ] Update version in `package.json`
- [ ] Update CHANGELOG.md with release notes
- [ ] Run full test suite
- [ ] Update API documentation if API changed
- [ ] Tag release in git: `git tag v1.2.3`
- [ ] Push tags: `git push --tags`
- [ ] Create GitHub Release with CHANGELOG excerpt

### Commit Message Format

Use conventional commits:

```
type(scope): description

feat(briefs): add platform selection
fix(auth): resolve session timeout issue
docs(readme): update installation instructions
BREAKING CHANGE: API error format changed to structured object
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

---

## Support Policy

### Supported Versions

| Version | Supported Until | Security Updates |
|---------|----------------|------------------|
| 1.x     | 6 months after 2.0 | Yes |
| 2.x     | Current         | Yes |

### LTS (Long Term Support)

Select versions may be designated LTS with extended support (18+ months).

---

## Related Links

- [Upgrade Guide](#migration-guides)
- [API Documentation](docs/api.md)
- [Architecture](ARCHITECTURE.md)
- [Contributing](CONTRIBUTING.md)
