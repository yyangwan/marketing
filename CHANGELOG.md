# Changelog

All notable changes to ContentOS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Interactive tutorial playground at `/playground`
- Standardized API error format following Stripe conventions
- Comprehensive API documentation (`docs/api.md`)
- Architecture documentation with system diagrams
- Contributing guide for developers
- Environment variable template (`.env.example`)

### Changed
- README.md: Complete rewrite from generic Next.js template
- Error handling: Migrated from plain strings to structured error objects
- Toast notifications: Replaced `alert()` with Sonner toasts

### Fixed
- Brief form error handling now shows detailed error messages
- API errors include doc_url links for self-service debugging

## [0.1.0] - 2024-04-XX

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
