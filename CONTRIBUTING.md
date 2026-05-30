# Contributing to SkillForge

Thanks for your interest in improving SkillForge! This project is MIT-licensed
and welcomes contributions.

## Development setup

```bash
git clone https://github.com/yvzhou1111/skillforge.git
cd skillforge
npm install
npm run build
npm run test:all   # unit tests + end-to-end suite
```

## Project layout

```
src/
  cli.ts / mcp.ts        # CLI and MCP entry points
  cli/                   # arg parsing, rendering, command implementations
  core/                  # scanner, intent, scorer, planner, auditor, linter, installer, service
  sources/               # catalog + GitHub skill sources
  agents/                # per-agent install-path adapters
  plugin/                # plugin installer + MCP config writers (JSON/YAML/TOML)
catalog/catalog.json     # curated, vetted skill index
skill/SKILL.md           # SkillForge as an installable meta-skill
.claude-plugin/          # Claude Code plugin + marketplace manifests
```

## Guidelines

- **Tests first.** Add or update unit tests under `src/**/*.test.ts` and, for
  CLI/MCP/plugin behavior, extend `test/e2e.sh`. Run `npm run test:all` before
  opening a PR.
- **Keep it dependency-light.** The runtime has a single dependency (`yaml`).
  Avoid adding new runtime deps without discussion.
- **Security matters.** Changes to the auditor (`src/core/auditor.ts`) should
  come with test cases for both true positives and benign content.
- **Catalog quality.** New catalog entries must lint to grade B or higher
  (`sf lint catalog:<name> --offline`) and come from a reputable source.
- **Docs.** Update `README.md` and, where practical, the localized
  `README.zh-CN.md` / `README.ja.md`.

## Adding support for a new agent

1. Add an adapter in `src/agents/adapter.ts` (install path for the agent).
2. Add an integration descriptor in `src/plugin/manifests.ts` (MCP config style
   + path). Reuse an existing `mcpStyle` (`mcpServers-json`, `hermes-yaml`,
   `openclaw-json`, `codex-toml`) or add a new writer in
   `src/plugin/mcpConfig.ts`.
3. Add tests.

## Commit & PR

- Use clear, present-tense commit messages.
- Keep PRs focused. Describe what changed, what you tested, and any tradeoffs.
- By contributing, you agree your contributions are licensed under the MIT License.
