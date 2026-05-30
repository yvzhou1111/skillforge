---
name: skillforge
description: Discover, security-audit, and install Agent Skills for the current project. Use this when the user asks "find a skill for X", "what skills do I need", wants to extend the agent's capabilities, or asks to set up skills for a project/tech stack. SkillForge scans the project, plans a skill combination, audits each skill for security risks, and installs them into the target agent (Claude Code, Cursor, Codex, Gemini, Hermes, OpenClaw). Works two ways: as MCP tools (skillforge_*) or by calling the `skillforge` CLI directly.
---

# SkillForge

SkillForge is the intelligent dependency butler for Agent Skills. It turns a
natural-language goal or a project's tech stack into a vetted, installed set of
skills — with a security audit before anything touches disk.

## Two ways to use it (pick whichever is available)

1. **MCP tools** — if the SkillForge MCP server is connected, call the
   `skillforge_*` tools directly (preferred; structured results).
2. **CLI** — if MCP is not available, run the `skillforge` (alias `sf`) command
   in the terminal. Every capability is available both ways.

## When to use this skill

- "Is there a skill for X" / "find a skill that does X"
- The agent needs a capability it lacks (design, testing, deploy, payments, i18n…)
- "Set up skills for this project" / "what skills should I install"
- Vet a third-party skill before installing it
- Discover, install, or manage agent skills

## Pipeline

```
scan (tech stack) + intent (NL goal) -> plan (ranked combo) -> audit (security) -> install (per agent)
```

## MCP tools

| Tool | Purpose |
|---|---|
| `skillforge_scan` | Detect a project's capability needs |
| `skillforge_search` | Search skills, ranked by relevance + quality |
| `skillforge_plan` | Recommend a skill combination (reasons + conflicts) |
| `skillforge_audit` | Static security audit of a skill |
| `skillforge_lint` | Quality-grade a skill (A–F) against authoring conventions |
| `skillforge_install` | Audit + install a skill into a target agent |
| `skillforge_list` | List installed skills from the lockfile |

## CLI usage (when MCP is unavailable)

Run via `npx skillforge-butler <command>` or `sf <command>` if installed globally.

```bash
# 1. Understand the project
sf scan                       # detect tech stack -> capability needs
sf scan --path ./my-app --json

# 2. Search the ecosystem
sf search "playwright e2e testing"
sf search "kubernetes" --offline      # built-in catalog only, no network

# 3. Plan a combination for a goal (no install)
sf plan "build a cross-border e-commerce site with payments and i18n"
sf plan "add CI and tests" --dry-run --json

# 4. ALWAYS audit before trusting a skill
sf audit catalog:react-best-practices
sf audit owner/repo/skills/their-skill      # audit a GitHub skill
sf audit --dir ./local-skill                # audit a local folder
# exit code 2 == blocked (high/critical risk)

# 4b. Check skill QUALITY (grade A–F)
sf lint catalog:react-best-practices
sf lint --dir ./local-skill                 # grade a local skill
# exit code 2 == failing grade (F)

# 5. Install one skill into a specific agent
sf install catalog:react-best-practices --agent claude-code
sf install owner/repo/skills/x --agent cursor --global
sf install owner/repo/skills/x --min-quality 75   # refuse low-quality skills

# 6. Full pipeline end-to-end (scan -> plan -> audit -> install)
sf auto "build a REST API with auth and tests" --agent claude-code
sf auto "add docker and CI" --dry-run        # preview without installing

# 7. Manage installed skills
sf list                       # show skillforge.lock.json entries
sf update                     # check installed skills for upstream changes
```

### Common CLI flags

| Flag | Meaning |
|---|---|
| `--agent <id>` | Target: claude-code \| cursor \| codex \| gemini \| generic |
| `--global`, `-g` | Install at user scope instead of project scope |
| `--offline` | Built-in catalog only (no network) |
| `--json` | Machine-readable output (parse this when scripting) |
| `--yes`, `-y` | Non-interactive (assume yes) |
| `--dry-run` | Plan only, do not install (auto) |
| `--skip-audit` | Skip the audit (NOT recommended) |
| `--force`, `-f` | Install despite a blocking audit (needs user consent) |
| `--overwrite` | Replace an already-installed skill |

## Recommended workflow for the agent

1. **Understand the need.** If the user gave a goal, use it as the intent; else
   run `skillforge_scan` / `sf scan`.
2. **Plan, don't guess.** Run `skillforge_plan` / `sf plan "<goal>"` and present
   the recommendations with their reasons and scores. Never install by name alone.
3. **Always audit.** Never bypass the audit. If a skill is `high`/`critical`,
   surface the specific finding (e.g. "this skill runs `curl | sh`") and require
   explicit user confirmation. Do not pass `--force` / `force:true` or
   `--skip-audit` unless the user explicitly insists.
4. **Install to the right agent.** Default `claude-code`. Use the agent matching
   the user's environment. Use `--global` only for cross-project skills.
5. **Confirm before writing.** Prefer the full pipeline (`sf auto` /
   plan→audit→install) and preview with `--dry-run` first.

## Safety rules

- Skills can contain executable scripts and tool-use hooks — treat them as
  untrusted code. The audit is the safety gate; respect a `blocked` result.
- For high/critical findings, explain the concrete risk, not just the score.
- Never install to production or shared environments without confirmation.

## When nothing matches

If plan/search return nothing relevant, tell the user no vetted skill was found
and offer to (a) help directly, or (b) scaffold a new skill with `sf init <name>`.
