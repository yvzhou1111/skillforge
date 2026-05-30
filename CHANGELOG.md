# Changelog

All notable changes to SkillForge are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.2] - 2026-05-30

### Fixed
- CLI `--version` and MCP `serverInfo.version` now read the real version from
  package.json at runtime instead of a hardcoded string.

## [0.1.1] - 2026-05-30

### Fixed
- Added a `skillforge-butler` bin alias so `npx skillforge-butler <command>`
  works directly (npm couldn't auto-resolve a bin from the package name before).

## [0.1.0] - 2026-05-30

### Added
- **Discovery & planning**: `scan` (tech-stack detection), `search` (ranked),
  `plan` (intent → skill combination with reasons + conflict detection).
- **Security audit** (`audit`): 12-rule static scanner for dangerous patterns
  (curl|sh, rm -rf, credential access, tool-use hooks, data exfiltration);
  blocks high/critical risk by default.
- **Quality gate** (`lint`): grades skills A–F against authoring conventions and
  content-quality heuristics, including multi-file / broken-link checks and a
  progressive-disclosure bonus. Install supports `--min-quality`.
- **Install** (`install`, `auto`): audit- and quality-gated installation into
  five agents (claude-code, cursor, codex, gemini, generic) with a lockfile.
- **Multi-agent plugin** (`plugin install|uninstall|status`): registers the
  SkillForge MCP server and skill into Claude Code, Cursor, Codex, Gemini,
  Hermes, OpenClaw, and a generic target — preserving and backing up configs.
- **MCP server** (`skillforge-mcp`): zero-dependency stdio MCP server exposing
  7 tools (scan, search, plan, audit, lint, install, list).
- **Meta-skill** (`skill/SKILL.md`): documents both the MCP tools and the full
  CLI usage so agents can use either path.
- **Claude Code plugin package** (`.claude-plugin/`): plugin + marketplace
  manifests for `/plugin install`.
- **Curated catalog**: 38 hand-vetted skills (all grade B+), spanning frontend,
  backend, DevOps, testing, security, docs, data, marketing, video, image,
  accessibility, MCP, and more.

### Tested
- 50+ unit tests (vitest) and a 60+ check end-to-end suite (`test/e2e.sh`),
  combined via `npm run test:all`.
