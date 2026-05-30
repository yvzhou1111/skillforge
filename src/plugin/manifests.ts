/**
 * Per-agent integration descriptors. Each describes HOW to register SkillForge
 * (its MCP server + skill) into a given agent: which config file to touch, what
 * shape the MCP entry takes, and where the skill folder lives.
 *
 * The common denominator across every modern agent is:
 *   1. An MCP server entry (command + args), and
 *   2. An AgentSkills-compatible SKILL.md folder.
 * Only the *location* and *key path* differ between agents.
 */
import path from "node:path";
import { homeDir } from "../util/fsx.js";

export type PluginAgentId =
  | "claude-code"
  | "hermes"
  | "openclaw"
  | "cursor"
  | "codex"
  | "gemini"
  | "generic";

/** How an agent stores its MCP server config. */
export type McpConfigStyle = "mcpServers-json" | "hermes-yaml" | "openclaw-json" | "codex-toml";

export interface AgentIntegration {
  id: PluginAgentId;
  label: string;
  /** Whether this agent supports MCP servers. */
  supportsMcp: boolean;
  /** MCP config style (controls how we merge the entry). */
  mcpStyle?: McpConfigStyle;
  /** Resolve the absolute MCP config file path for a scope. */
  mcpConfigPath?: (ctx: PathContext) => string;
  /** Key inside the config object that holds MCP servers. */
  mcpKey?: string;
  /** Resolve the directory the SkillForge skill folder is copied into. */
  skillDir: (ctx: PathContext) => string;
  /** Human-readable post-install verification hint. */
  verifyHint: string;
}

export interface PathContext {
  projectRoot: string;
  global: boolean;
  home: string;
}

/** The MCP server entry SkillForge registers (same shape everywhere). */
export interface McpServerEntry {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export function skillForgeMcpEntry(): McpServerEntry {
  return {
    command: "npx",
    args: ["-y", "skillforge-mcp"],
    env: {},
  };
}

function p(...segs: string[]): string {
  return path.join(...segs);
}

export const INTEGRATIONS: Record<PluginAgentId, AgentIntegration> = {
  "claude-code": {
    id: "claude-code",
    label: "Claude Code",
    supportsMcp: true,
    mcpStyle: "mcpServers-json",
    mcpKey: "mcpServers",
    mcpConfigPath: ({ projectRoot, global, home }) =>
      global ? p(home, ".claude", "settings.json") : p(projectRoot, ".mcp.json"),
    skillDir: ({ projectRoot, global, home }) =>
      global ? p(home, ".claude", "skills", "skillforge") : p(projectRoot, ".claude", "skills", "skillforge"),
    verifyHint:
      "Run `claude` then `/mcp` to confirm 'skillforge' is connected, and `/skills` to see the skillforge skill.",
  },
  hermes: {
    id: "hermes",
    label: "Hermes Agent (Nous Research)",
    supportsMcp: true,
    mcpStyle: "hermes-yaml",
    mcpKey: "mcp_servers",
    mcpConfigPath: ({ home }) => p(home, ".hermes", "config.yaml"),
    skillDir: ({ projectRoot, global, home }) =>
      global ? p(home, ".hermes", "skills", "skillforge") : p(projectRoot, ".hermes", "skills", "skillforge"),
    verifyHint:
      "Start Hermes and check that the 'skillforge' MCP server tools are listed; the skillforge skill loads from the skills folder.",
  },
  openclaw: {
    id: "openclaw",
    label: "OpenClaw",
    supportsMcp: true,
    mcpStyle: "openclaw-json",
    mcpKey: "mcp",
    mcpConfigPath: ({ home }) => p(home, ".openclaw", "openclaw.json"),
    skillDir: ({ projectRoot, global, home }) =>
      global ? p(home, ".openclaw", "skills", "skillforge") : p(projectRoot, ".openclaw", "skills", "skillforge"),
    verifyHint:
      "Check ~/.openclaw/openclaw.json has the skillforge MCP entry, and run the OpenClaw skills list to confirm the skill loaded.",
  },
  cursor: {
    id: "cursor",
    label: "Cursor",
    supportsMcp: true,
    mcpStyle: "mcpServers-json",
    mcpKey: "mcpServers",
    mcpConfigPath: ({ projectRoot, global, home }) =>
      global ? p(home, ".cursor", "mcp.json") : p(projectRoot, ".cursor", "mcp.json"),
    skillDir: ({ projectRoot, global, home }) =>
      global ? p(home, ".cursor", "skills", "skillforge") : p(projectRoot, ".cursor", "skills", "skillforge"),
    verifyHint: "Open Cursor Settings → MCP to confirm 'skillforge' is listed and enabled.",
  },
  codex: {
    id: "codex",
    label: "OpenAI Codex CLI",
    supportsMcp: true,
    mcpStyle: "codex-toml",
    mcpKey: "mcp_servers",
    mcpConfigPath: ({ projectRoot, global, home }) =>
      global ? p(home, ".codex", "config.toml") : p(projectRoot, ".codex", "config.toml"),
    skillDir: ({ projectRoot, global, home }) =>
      global ? p(home, ".codex", "skills", "skillforge") : p(projectRoot, ".codex", "skills", "skillforge"),
    verifyHint:
      "Check ~/.codex/config.toml for a [mcp_servers.skillforge] table, then run `codex` and confirm the skillforge MCP tools are available.",
  },
  gemini: {
    id: "gemini",
    label: "Gemini CLI",
    supportsMcp: true,
    mcpStyle: "mcpServers-json",
    mcpKey: "mcpServers",
    mcpConfigPath: ({ projectRoot, global, home }) =>
      global ? p(home, ".gemini", "settings.json") : p(projectRoot, ".gemini", "settings.json"),
    skillDir: ({ projectRoot, global, home }) =>
      global ? p(home, ".gemini", "skills", "skillforge") : p(projectRoot, ".gemini", "skills", "skillforge"),
    verifyHint: "Run `gemini mcp list` to confirm 'skillforge' is registered.",
  },
  generic: {
    id: "generic",
    label: "Generic (SKILL.md + MCP)",
    supportsMcp: true,
    mcpStyle: "mcpServers-json",
    mcpKey: "mcpServers",
    mcpConfigPath: ({ projectRoot, global, home }) =>
      global ? p(home, ".skills", "mcp.json") : p(projectRoot, ".skills", "mcp.json"),
    skillDir: ({ projectRoot, global, home }) =>
      global ? p(home, ".skills", "skillforge") : p(projectRoot, ".skills", "skillforge"),
    verifyHint: "Point your agent at the .skills/skillforge folder and the generated mcp.json.",
  },
};

export function getIntegration(id: PluginAgentId): AgentIntegration {
  const it = INTEGRATIONS[id];
  if (!it) throw new Error(`Unknown plugin agent: ${id}`);
  return it;
}

export function listPluginAgents(): PluginAgentId[] {
  return Object.keys(INTEGRATIONS) as PluginAgentId[];
}

export function isPluginAgent(value: string): value is PluginAgentId {
  return value in INTEGRATIONS;
}

export function makePathContext(projectRoot: string, global: boolean): PathContext {
  return { projectRoot, global, home: homeDir() };
}
