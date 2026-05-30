import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getIntegration,
  makePathContext,
  skillForgeMcpEntry,
  type PluginAgentId,
} from "./manifests.js";
import { mergeMcpConfig, removeMcpConfig, type MergeResult } from "./mcpConfig.js";
import { copyDir, ensureDir, pathExists } from "../util/fsx.js";

export interface PluginInstallOptions {
  agent: PluginAgentId;
  global: boolean;
  projectRoot: string;
  /** Don't write anything; just report what would happen. */
  dryRun?: boolean;
}

export interface PluginInstallReport {
  agent: PluginAgentId;
  label: string;
  skillDir: string;
  skillCopied: boolean;
  mcp?: MergeResult;
  mcpSupported: boolean;
  verifyHint: string;
  dryRun: boolean;
}

/** Locate the bundled skill/ folder shipped with the package. */
export function resolveBundledSkillDir(): string {
  // dist/plugin/installer.js -> ../../skill
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..", "skill");
}

/**
 * Install SkillForge into a target agent: copy the skill folder and register
 * the MCP server in the agent's config.
 */
export async function installPlugin(
  opts: PluginInstallOptions
): Promise<PluginInstallReport> {
  const integration = getIntegration(opts.agent);
  const ctx = makePathContext(opts.projectRoot, opts.global);
  const skillDir = integration.skillDir(ctx);

  const report: PluginInstallReport = {
    agent: opts.agent,
    label: integration.label,
    skillDir,
    skillCopied: false,
    mcpSupported: integration.supportsMcp,
    verifyHint: integration.verifyHint,
    dryRun: !!opts.dryRun,
  };

  if (opts.dryRun) {
    if (integration.supportsMcp && integration.mcpConfigPath) {
      report.mcp = {
        configPath: integration.mcpConfigPath(ctx),
        created: !(await pathExists(integration.mcpConfigPath(ctx))),
        alreadyPresent: false,
      };
    }
    return report;
  }

  // 1. Copy the skill folder (SKILL.md + any resources).
  const bundled = resolveBundledSkillDir();
  if (await pathExists(bundled)) {
    await ensureDir(skillDir);
    await copyDir(bundled, skillDir);
    report.skillCopied = true;
  }

  // 2. Register the MCP server.
  if (integration.supportsMcp && integration.mcpConfigPath) {
    const configPath = integration.mcpConfigPath(ctx);
    report.mcp = await mergeMcpConfig(integration, configPath, skillForgeMcpEntry());
  }

  return report;
}

export interface PluginUninstallReport {
  agent: PluginAgentId;
  skillRemoved: boolean;
  mcpRemoved: boolean;
  skillDir: string;
}

export async function uninstallPlugin(
  opts: Omit<PluginInstallOptions, "dryRun">
): Promise<PluginUninstallReport> {
  const integration = getIntegration(opts.agent);
  const ctx = makePathContext(opts.projectRoot, opts.global);
  const skillDir = integration.skillDir(ctx);

  let skillRemoved = false;
  if (await pathExists(skillDir)) {
    await fs.rm(skillDir, { recursive: true, force: true });
    skillRemoved = true;
  }

  let mcpRemoved = false;
  if (integration.supportsMcp && integration.mcpConfigPath) {
    mcpRemoved = await removeMcpConfig(integration, integration.mcpConfigPath(ctx));
  }

  return { agent: opts.agent, skillRemoved, mcpRemoved, skillDir };
}

export interface PluginStatusEntry {
  agent: PluginAgentId;
  label: string;
  skillInstalled: boolean;
  skillDir: string;
  mcpConfigPath?: string;
  mcpConfigExists: boolean;
}

/** Report which agents currently have SkillForge installed (project + checked paths). */
export async function pluginStatus(
  projectRoot: string,
  global: boolean,
  agents: PluginAgentId[]
): Promise<PluginStatusEntry[]> {
  const out: PluginStatusEntry[] = [];
  for (const agent of agents) {
    const integration = getIntegration(agent);
    const ctx = makePathContext(projectRoot, global);
    const skillDir = integration.skillDir(ctx);
    const mcpConfigPath = integration.mcpConfigPath?.(ctx);
    out.push({
      agent,
      label: integration.label,
      skillInstalled: await pathExists(path.join(skillDir, "SKILL.md")),
      skillDir,
      mcpConfigPath,
      mcpConfigExists: mcpConfigPath ? await pathExists(mcpConfigPath) : false,
    });
  }
  return out;
}
