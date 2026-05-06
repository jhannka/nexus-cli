# Changelog

All notable changes to @walzate1/prism-pre-commit are documented here.

Format: [Semantic Versioning](https://semver.org/)

## [Unreleased]

### Added
- Initial release (v1.0.0)

## [1.0.0] — 2026-05-06

### Added

- **Automated pre-commit hook** — Runs before every git commit
- **Four-stage validation pipeline:**
  - ESLint lint checking with auto-fix
  - Prettier format validation
  - TypeScript type checking
  - Vitest test suite execution
- **Zero-config setup** — One command installation via `prism-pre-commit-setup`
- **Smart dependency detection** — Automatically installs husky + lint-staged if missing
- **Flexible configuration:**
  - `.husky/pre-commit` — Hook script (customizable)
  - `.lint-stagedrc.json` — File filtering rules
- **Comprehensive documentation:**
  - README with install, troubleshooting, FAQ
  - QUICK_START for 2-minute setup
  - CONTRIBUTING guide for developers
- **Cross-platform support:**
  - Windows (Git Bash, WSL)
  - macOS
  - Linux

### Technical Details

- Runtime: Node.js ≥22.5.0
- No external dependencies (minimal footprint)
- ESLint v9+ (FlatConfig)
- TypeScript support for `.ts` and `.tsx` files
- Works with npm, pnpm, yarn

---

## Versioning

- **MAJOR** — Breaking changes to hook behavior or setup process
- **MINOR** — New features (new checks, new config options)
- **PATCH** — Bug fixes, documentation updates

## Reporting Issues

Found a bug? Have a feature request?

→ https://bitbucket.org/walzate1/prism-cli-pre-commit/issues
