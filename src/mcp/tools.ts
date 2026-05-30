/**
 * MCP tool definitions for SkillForge. Each tool maps to a service-layer call.
 * Tool schemas follow JSON Schema as expected by MCP clients.
 */
import * as service from "../core/service.js";
import { listAgents } from "../agents/adapter.js";
import type { AgentId, InstallScope } from "../types.js";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

function str(args: Record<string, unknown>, key: string, fallback = ""): string {
  const v = args[key];
  return typeof v === "string" ? v : fallback;
}

function bool(args: Record<string, unknown>, key: string): boolean {
  return args[key] === true || args[key] === "true";
}

function num(args: Record<string, unknown>, key: string, fallback: number): number {
  const v = args[key];
  return typeof v === "number" ? v : fallback;
}

const githubToken = process.env.GITHUB_TOKEN;

export const TOOLS: McpTool[] = [
  {
    name: "skillforge_scan",
    description:
      "Scan a project directory and infer the technical capability needs (e.g. react, testing, docker) from its dependency and config files. Use this first to understand what a project needs before recommending skills.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Absolute path to the project root. Defaults to the current working directory.",
        },
      },
    },
    handler: async (args) => {
      const root = str(args, "projectPath") || process.cwd();
      return service.scan(root);
    },
  },
  {
    name: "skillforge_search",
    description:
      "Search the Agent Skills ecosystem for skills matching a free-text query, ranked by relevance and quality (installs, stars, source reputation). Use when the user asks 'is there a skill for X'.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search, e.g. 'playwright e2e testing'." },
        offline: { type: "boolean", description: "Use only the built-in catalog (no network)." },
        limit: { type: "number", description: "Max results (default 15)." },
      },
      required: ["query"],
    },
    handler: async (args) => {
      const { results, failures } = await service.search(str(args, "query"), {
        offline: bool(args, "offline"),
        githubToken,
      });
      return { results: results.slice(0, num(args, "limit", 15)), failures };
    },
  },
  {
    name: "skillforge_plan",
    description:
      "Recommend a combination of skills for a project and/or a natural-language goal. Returns ranked recommendations with reasons and detected conflicts. This is the smart 'what should I install' planner. Always present these to the user before installing.",
    inputSchema: {
      type: "object",
      properties: {
        intent: { type: "string", description: "Natural-language goal, e.g. 'build a cross-border e-commerce site with payments'." },
        projectPath: { type: "string", description: "Project root to scan. Defaults to cwd." },
        offline: { type: "boolean" },
        noScan: { type: "boolean", description: "Skip project scanning; use intent only." },
        limit: { type: "number", description: "Max recommendations (default 10)." },
      },
    },
    handler: async (args) => {
      const { plan, failures } = await service.plan({
        intent: str(args, "intent") || undefined,
        projectRoot: str(args, "projectPath") || process.cwd(),
        offline: bool(args, "offline"),
        noScan: bool(args, "noScan"),
        limit: num(args, "limit", 10),
        githubToken,
      });
      return { plan, failures };
    },
  },
  {
    name: "skillforge_audit",
    description:
      "Statically security-audit a skill BEFORE installing it. Detects dangerous patterns (curl|sh, rm -rf, credential access, tool-use hooks, data exfiltration). Returns findings with risk levels. ALWAYS audit untrusted skills; treat 'blocked: true' as a hard stop unless the user explicitly overrides.",
    inputSchema: {
      type: "object",
      properties: {
        skillRef: {
          type: "string",
          description: "Skill id (e.g. 'catalog:react-best-practices'), catalog name, or 'owner/repo/subPath'.",
        },
        offline: { type: "boolean" },
      },
      required: ["skillRef"],
    },
    handler: async (args) =>
      service.audit(str(args, "skillRef"), {
        offline: bool(args, "offline"),
        githubToken,
      }),
  },
  {
    name: "skillforge_lint",
    description:
      "Quality-grade a skill (A–F, 0–100 score) against AgentSkills authoring conventions and content-quality heuristics: description clarity and triggering, body structure, examples, placeholder/TODO leftovers. Use to ensure recommended skills are high quality before installing.",
    inputSchema: {
      type: "object",
      properties: {
        skillRef: {
          type: "string",
          description: "Skill id (e.g. 'catalog:react-best-practices'), catalog name, or 'owner/repo/subPath'.",
        },
        offline: { type: "boolean" },
      },
      required: ["skillRef"],
    },
    handler: async (args) =>
      service.lint(str(args, "skillRef"), {
        offline: bool(args, "offline"),
        githubToken,
      }),
  },
  {
    name: "skillforge_install",
    description:
      "Install a skill into a target agent. Runs a security audit first and refuses high/critical-risk skills unless 'force' is true. Records the install in the project lockfile. Confirm with the user before calling this.",
    inputSchema: {
      type: "object",
      properties: {
        skillRef: { type: "string", description: "Skill id, catalog name, or owner/repo/subPath." },
        agent: {
          type: "string",
          enum: listAgents(),
          description: "Target agent. Default 'claude-code'.",
        },
        scope: { type: "string", enum: ["project", "global"], description: "Install scope. Default 'project'." },
        projectPath: { type: "string", description: "Project root. Defaults to cwd." },
        offline: { type: "boolean" },
        force: { type: "boolean", description: "Install even if the audit blocks (high/critical). Use only with user consent." },
        overwrite: { type: "boolean", description: "Replace an already-installed skill." },
      },
      required: ["skillRef"],
    },
    handler: async (args) => {
      const agent = (str(args, "agent") || "claude-code") as AgentId;
      const scope = (str(args, "scope") || "project") as InstallScope;
      return service.install({
        ref: str(args, "skillRef"),
        agent,
        scope,
        projectRoot: str(args, "projectPath") || process.cwd(),
        offline: bool(args, "offline"),
        force: bool(args, "force"),
        overwrite: bool(args, "overwrite"),
        githubToken,
      });
    },
  },
  {
    name: "skillforge_list",
    description:
      "List the skills already installed in a project, as recorded in skillforge.lock.json (name, agent, scope, source).",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Project root. Defaults to cwd." },
      },
    },
    handler: async (args) =>
      service.listInstalled(str(args, "projectPath") || process.cwd()),
  },
];

export function findTool(name: string): McpTool | undefined {
  return TOOLS.find((t) => t.name === name);
}
