import { promises as fs } from "node:fs";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { AgentIntegration, McpServerEntry } from "./manifests.js";
import { ensureDir, pathExists, readTextIfExists } from "../util/fsx.js";
import { removeTomlMcpBlock, upsertTomlMcpBlock } from "./tomlConfig.js";

export interface MergeResult {
  configPath: string;
  created: boolean;
  alreadyPresent: boolean;
  backupPath?: string;
}

const SERVER_NAME = "skillforge";

/**
 * Merge the SkillForge MCP server entry into an agent's config file,
 * preserving existing content and backing up the original.
 */
export async function mergeMcpConfig(
  integration: AgentIntegration,
  configPath: string,
  entry: McpServerEntry
): Promise<MergeResult> {
  const exists = await pathExists(configPath);
  const raw = exists ? await readTextIfExists(configPath) : null;

  let backupPath: string | undefined;
  if (exists && raw) {
    backupPath = `${configPath}.skillforge-backup`;
    await fs.writeFile(backupPath, raw, "utf8");
  }

  await ensureDir(path.dirname(configPath));

  if (integration.mcpStyle === "codex-toml") {
    return writeTomlConfig(configPath, entry, raw, exists, backupPath);
  }
  if (integration.mcpStyle === "hermes-yaml") {
    return writeYamlConfig(configPath, integration.mcpKey!, entry, raw, exists, backupPath);
  }
  // JSON styles (mcpServers-json / openclaw-json)
  return writeJsonConfig(configPath, integration.mcpKey!, entry, raw, exists, backupPath);
}

async function writeTomlConfig(
  configPath: string,
  entry: McpServerEntry,
  raw: string | null,
  exists: boolean,
  backupPath: string | undefined
): Promise<MergeResult> {
  const { content, alreadyPresent } = upsertTomlMcpBlock(raw, entry);
  await fs.writeFile(configPath, content, "utf8");
  return { configPath, created: !exists, alreadyPresent, backupPath };
}

async function writeJsonConfig(
  configPath: string,
  key: string,
  entry: McpServerEntry,
  raw: string | null,
  exists: boolean,
  backupPath: string | undefined
): Promise<MergeResult> {
  let root: Record<string, unknown> = {};
  if (raw) {
    try {
      root = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      root = {};
    }
  }
  const servers = (root[key] as Record<string, unknown>) ?? {};
  const alreadyPresent = SERVER_NAME in servers;
  servers[SERVER_NAME] = entry;
  root[key] = servers;

  await fs.writeFile(configPath, JSON.stringify(root, null, 2) + "\n", "utf8");
  return { configPath, created: !exists, alreadyPresent, backupPath };
}

async function writeYamlConfig(
  configPath: string,
  key: string,
  entry: McpServerEntry,
  raw: string | null,
  exists: boolean,
  backupPath: string | undefined
): Promise<MergeResult> {
  let root: Record<string, unknown> = {};
  if (raw) {
    try {
      const parsed = parseYaml(raw);
      if (parsed && typeof parsed === "object") root = parsed as Record<string, unknown>;
    } catch {
      root = {};
    }
  }
  const servers = (root[key] as Record<string, unknown>) ?? {};
  const alreadyPresent = SERVER_NAME in servers;
  // Hermes uses `command`/`args` under mcp_servers.<name>.
  servers[SERVER_NAME] = entry;
  root[key] = servers;

  await fs.writeFile(configPath, stringifyYaml(root), "utf8");
  return { configPath, created: !exists, alreadyPresent, backupPath };
}

/** Remove the SkillForge MCP entry from a config file. */
export async function removeMcpConfig(
  integration: AgentIntegration,
  configPath: string
): Promise<boolean> {
  const raw = await readTextIfExists(configPath);
  if (!raw) return false;
  const key = integration.mcpKey!;

  if (integration.mcpStyle === "codex-toml") {
    const updated = removeTomlMcpBlock(raw);
    if (updated === null) return false;
    await fs.writeFile(configPath, updated, "utf8");
    return true;
  }

  if (integration.mcpStyle === "hermes-yaml") {
    let root: Record<string, unknown>;
    try {
      root = parseYaml(raw) as Record<string, unknown>;
    } catch {
      return false;
    }
    const servers = root?.[key] as Record<string, unknown> | undefined;
    if (servers && SERVER_NAME in servers) {
      delete servers[SERVER_NAME];
      await fs.writeFile(configPath, stringifyYaml(root), "utf8");
      return true;
    }
    return false;
  }

  let root: Record<string, unknown>;
  try {
    root = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return false;
  }
  const servers = root?.[key] as Record<string, unknown> | undefined;
  if (servers && SERVER_NAME in servers) {
    delete servers[SERVER_NAME];
    await fs.writeFile(configPath, JSON.stringify(root, null, 2) + "\n", "utf8");
    return true;
  }
  return false;
}
