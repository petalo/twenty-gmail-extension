# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] - 2026-02-25

### Added

- Gmail add-on sidebar with contextual trigger on message open.
- Sender lookup: person by email, company by domain, related opportunities.
- Create Markdown notes attached to any matched entity.
- Create activities (tasks) with optional due date, linked to person or company.
- Quick-create person, company, or opportunity from the sidebar.
- Company search by name or domain within the quick-create flow.
- Per-user API token authentication stored in Google UserProperties.
- Sidebar state caching to reduce redundant API calls.
- Ambiguous match handling when multiple companies share a domain.
- Recent companies MRU list for faster entity linking.
- Biome linting and formatting with pre-commit hook (Husky + lint-staged).
- CI workflow for lint and syntax checks on push and PR.
- Full JSDoc documentation across all source files.
- Twenty API contract reference documentation.
- Pinned GitHub Actions references to commit SHAs.
