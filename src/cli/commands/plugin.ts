import path from "node:path";
import {
  installPlugin,
  pluginStatus,
  uninstallPlugin,
} from "../../plugin/installer.js";
import {
  isPluginAgent,
  listPluginAgents,
  type PluginAgentId,
} from "../../plugin/manifests.js";
import { c, log } from "../../util/log.js";
import type { ParsedArgs } from "../args.js";
import { getBool, getString } from "../args.js";

export async function cmdPlugin(args: ParsedArgs): Promise<number> {
  const sub = args._[0];
  const subArgs = { ...args, _: args._.slice(1) };
  switch (sub) {
    case "install":
      return pluginInstall(subArgs);
    case "uninstall":
    case "remove":
      return pluginUninstall(subArgs);
    case "status":
    case "list":
      return pluginStatusCmd(subArgs);
    default:
      log.error('Usage: skillforge plugin <install|uninstall|status> --agent <agent>');
      log.info(`Agents: ${listPluginAgents().join(", ")}`);
      return 1;
  }
}

function resolveAgent(args: ParsedArgs): PluginAgentId | null {
  const raw = getString(args, ["agent", "a"]);
  if (!raw) return null;
  if (!isPluginAgent(raw)) {
    log.error(`Unknown agent "${raw}". Valid: ${listPluginAgents().join(", ")}`);
    return null;
  }
  return raw;
}

async function pluginInstall(args: ParsedArgs): Promise<number> {
  const agent = resolveAgent(args);
  if (!agent) {
    log.error("Specify --agent. " + `Valid: ${listPluginAgents().join(", ")}`);
    return 1;
  }
  const global = getBool(args, ["global", "g"]);
  const dryRun = getBool(args, ["dry-run"]);
  const projectRoot = path.resolve(getString(args, ["path", "p"]) ?? process.cwd());

  log.step(
    `${dryRun ? "[dry-run] " : ""}Installing SkillForge into ${c.green(agent)} (${global ? "global" : "project"})`
  );

  const report = await installPlugin({ agent, global, projectRoot, dryRun });

  if (dryRun) {
    log.info(`Would copy skill → ${c.dim(report.skillDir)}`);
    if (report.mcp) {
      log.info(`Would register MCP server in → ${c.dim(report.mcp.configPath)}`);
    }
    log.info(c.dim("No changes written (dry run)."));
    return 0;
  }

  if (report.skillCopied) {
    log.ok(`Skill installed → ${c.dim(report.skillDir)}`);
  } else {
    log.warn("Bundled skill folder not found; skill was not copied.");
  }

  if (report.mcp) {
    const status = report.mcp.alreadyPresent
      ? "updated existing"
      : report.mcp.created
        ? "created config"
        : "added to existing config";
    log.ok(`MCP server registered (${status}) → ${c.dim(report.mcp.configPath)}`);
    if (report.mcp.backupPath) {
      log.info(c.dim(`Backup saved → ${report.mcp.backupPath}`));
    }
  } else if (!report.mcpSupported) {
    log.info("This agent does not use MCP; skill-only install.");
  }

  log.raw("");
  log.info(c.bold("Verify: ") + report.verifyHint);
  log.info(
    c.dim(
      "The skill includes full CLI usage, so the agent can also call `skillforge` directly when MCP isn't available."
    )
  );
  return 0;
}

async function pluginUninstall(args: ParsedArgs): Promise<number> {
  const agent = resolveAgent(args);
  if (!agent) return 1;
  const global = getBool(args, ["global", "g"]);
  const projectRoot = path.resolve(getString(args, ["path", "p"]) ?? process.cwd());

  const report = await uninstallPlugin({ agent, global, projectRoot });
  if (report.skillRemoved) log.ok(`Removed skill folder → ${c.dim(report.skillDir)}`);
  else log.info("No skill folder found to remove.");
  if (report.mcpRemoved) log.ok("Removed SkillForge MCP entry from config.");
  else log.info("No MCP entry found to remove.");
  return 0;
}

async function pluginStatusCmd(args: ParsedArgs): Promise<number> {
  const global = getBool(args, ["global", "g"]);
  const projectRoot = path.resolve(getString(args, ["path", "p"]) ?? process.cwd());
  const asJson = getBool(args, ["json"]);

  const entries = await pluginStatus(projectRoot, global, listPluginAgents());

  if (asJson) {
    log.raw(JSON.stringify(entries, null, 2));
    return 0;
  }

  log.raw(c.bold(`\nSkillForge plugin status (${global ? "global" : "project"}):`));
  for (const e of entries) {
    const mark = e.skillInstalled ? c.green("✓ installed") : c.dim("· not installed");
    log.raw(`  ${e.label.padEnd(28)} ${mark}`);
    if (e.skillInstalled) {
      log.raw(`      ${c.dim("skill: " + e.skillDir)}`);
      if (e.mcpConfigExists && e.mcpConfigPath) {
        log.raw(`      ${c.dim("mcp:   " + e.mcpConfigPath)}`);
      }
    }
  }
  return 0;
}
