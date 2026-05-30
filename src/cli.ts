#!/usr/bin/env node
import { parseArgs } from "./cli/args.js";
import { cmdAudit } from "./cli/commands/audit.js";
import { cmdAuto } from "./cli/commands/auto.js";
import { cmdInit } from "./cli/commands/init.js";
import { cmdInstall } from "./cli/commands/install.js";
import { cmdLint } from "./cli/commands/lint.js";
import { cmdList } from "./cli/commands/list.js";
import { cmdPlan } from "./cli/commands/plan.js";
import { cmdPlugin } from "./cli/commands/plugin.js";
import { cmdScan } from "./cli/commands/scan.js";
import { cmdSearch } from "./cli/commands/search.js";
import { cmdUpdate } from "./cli/commands/update.js";
import { startMcpServer } from "./mcp/server.js";
import { c, log, setColor, setQuiet } from "./util/log.js";

const VERSION = "0.1.0";

const HELP = `${c.bold("SkillForge")} ${c.dim("v" + VERSION)} — the intelligent Agent-Skill dependency butler.

${c.bold("USAGE")}
  skillforge <command> [options]
  sf <command> [options]

${c.bold("COMMANDS")}
  ${c.cyan("scan")}                     Detect your project's tech stack -> capability needs
  ${c.cyan("search")} <query>           Search skills across all sources, ranked by relevance+quality
  ${c.cyan("plan")} ["<intent>"]        Recommend a skill combination for your project/intent
  ${c.cyan("audit")} <id|--dir path>    Security-audit a skill before installing it
  ${c.cyan("lint")} <id|--dir path>     Quality-grade a skill (A–F) against authoring conventions
  ${c.cyan("install")} <id> [--agent]   Audit + install one skill into a target agent
  ${c.cyan("auto")} ["<intent>"]        Full pipeline: scan -> plan -> audit -> install
  ${c.cyan("list")}                     Show skills recorded in skillforge.lock.json
  ${c.cyan("update")}                   Check installed skills for upstream changes
  ${c.cyan("init")} <name>              Scaffold a new SKILL.md
  ${c.cyan("plugin")} <install|...>     Install SkillForge itself into an agent (skill + MCP)
  ${c.cyan("mcp")}                      Run the SkillForge MCP server (stdio) for agents

${c.bold("COMMON OPTIONS")}
  --agent <id>      Target agent: claude-code | cursor | codex | gemini | generic
  --global, -g      Install at user scope instead of project scope
  --offline         Use only the built-in catalog (no network)
  --json            Machine-readable JSON output
  --yes, -y         Assume yes for prompts (non-interactive)
  --dry-run         Plan only; do not install (auto)
  --no-llm          Disable LLM refinement even if an API key is set
  --skip-audit      Skip the security audit (not recommended)
  --min-quality <n> Refuse to install skills scoring below n (0-100)
  --force, -f       Install even if the audit blocks (high/critical risk)
  --overwrite       Replace an already-installed skill
  --quiet           Suppress non-essential output
  --no-color        Disable ANSI colors

${c.bold("EXAMPLES")}
  sf scan
  sf auto "build a cross-border e-commerce site with payments and i18n" --agent claude-code
  sf search "playwright e2e testing"
  sf audit owner/repo/skills/some-skill
  sf install catalog:react-best-practices --agent cursor -g
  sf plugin install --agent claude-code
  sf plugin install --agent hermes --global
  sf plugin status

${c.bold("ENV")}
  GITHUB_TOKEN              Raise GitHub API rate limits when fetching skills
  SKILLFORGE_LLM_API_KEY    Enable LLM-enhanced intent analysis (OpenAI-compatible)
  SKILLFORGE_LLM_BASE_URL   Override the LLM endpoint (default OpenAI)
  SKILLFORGE_LLM_MODEL      Override the model (default gpt-4o-mini)
`;

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);

  if (args.flags["no-color"]) setColor(false);
  if (args.flags["quiet"]) setQuiet(true);

  if (args.flags["version"] || args.flags["v"]) {
    log.raw(VERSION);
    return 0;
  }

  const command = args._[0];
  // Drop the command token from positionals for sub-handlers.
  const subArgs = { ...args, _: args._.slice(1) };

  if (!command || args.flags["help"] || args.flags["h"]) {
    if (!command) log.raw(HELP);
    else log.raw(HELP);
    return command ? 0 : 0;
  }

  switch (command) {
    case "scan":
      return cmdScan(subArgs);
    case "search":
    case "find":
      return cmdSearch(subArgs);
    case "plan":
      return cmdPlan(subArgs);
    case "audit":
      return cmdAudit(subArgs);
    case "lint":
      return cmdLint(subArgs);
    case "install":
    case "add":
      return cmdInstall(subArgs);
    case "auto":
      return cmdAuto(subArgs);
    case "list":
    case "ls":
      return cmdList(subArgs);
    case "update":
    case "check":
      return cmdUpdate(subArgs);
    case "init":
      return cmdInit(subArgs);
    case "plugin":
      return cmdPlugin(subArgs);
    case "mcp":
    case "serve":
      startMcpServer();
      return new Promise<number>(() => {
        /* runs until stdin closes; process.exit handled in server */
      });
    case "help":
      log.raw(HELP);
      return 0;
    default:
      log.error(`Unknown command: ${command}`);
      log.info('Run "skillforge help" for usage.');
      return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    log.error(err instanceof Error ? err.stack ?? err.message : String(err));
    process.exit(1);
  });
