import path from "node:path";
import type { AgentId, InstallScope } from "../types.js";
import { homeDir } from "../util/fsx.js";

/**
 * An AgentAdapter knows where a given agent expects skills to live, for both
 * project and global scopes. SkillForge writes the skill folder there.
 */
export interface AgentAdapter {
  readonly id: AgentId;
  readonly label: string;
  /** Return the directory where a skill named `skillName` should be installed. */
  resolveSkillDir(args: {
    skillName: string;
    scope: InstallScope;
    projectRoot: string;
  }): string;
}

class ClaudeCodeAdapter implements AgentAdapter {
  readonly id = "claude-code" as const;
  readonly label = "Claude Code";
  resolveSkillDir({ skillName, scope, projectRoot }: {
    skillName: string;
    scope: InstallScope;
    projectRoot: string;
  }): string {
    const base =
      scope === "global"
        ? path.join(homeDir(), ".claude", "skills")
        : path.join(projectRoot, ".claude", "skills");
    return path.join(base, skillName);
  }
}

class CursorAdapter implements AgentAdapter {
  readonly id = "cursor" as const;
  readonly label = "Cursor";
  resolveSkillDir({ skillName, scope, projectRoot }: {
    skillName: string;
    scope: InstallScope;
    projectRoot: string;
  }): string {
    const base =
      scope === "global"
        ? path.join(homeDir(), ".cursor", "skills")
        : path.join(projectRoot, ".cursor", "skills");
    return path.join(base, skillName);
  }
}

class CodexAdapter implements AgentAdapter {
  readonly id = "codex" as const;
  readonly label = "OpenAI Codex";
  resolveSkillDir({ skillName, scope, projectRoot }: {
    skillName: string;
    scope: InstallScope;
    projectRoot: string;
  }): string {
    const base =
      scope === "global"
        ? path.join(homeDir(), ".codex", "skills")
        : path.join(projectRoot, ".codex", "skills");
    return path.join(base, skillName);
  }
}

class GeminiAdapter implements AgentAdapter {
  readonly id = "gemini" as const;
  readonly label = "Gemini CLI";
  resolveSkillDir({ skillName, scope, projectRoot }: {
    skillName: string;
    scope: InstallScope;
    projectRoot: string;
  }): string {
    const base =
      scope === "global"
        ? path.join(homeDir(), ".gemini", "skills")
        : path.join(projectRoot, ".gemini", "skills");
    return path.join(base, skillName);
  }
}

class GenericAdapter implements AgentAdapter {
  readonly id = "generic" as const;
  readonly label = "Generic (.skills)";
  resolveSkillDir({ skillName, scope, projectRoot }: {
    skillName: string;
    scope: InstallScope;
    projectRoot: string;
  }): string {
    const base =
      scope === "global"
        ? path.join(homeDir(), ".skills")
        : path.join(projectRoot, ".skills");
    return path.join(base, skillName);
  }
}

const ADAPTERS: Record<AgentId, AgentAdapter> = {
  "claude-code": new ClaudeCodeAdapter(),
  cursor: new CursorAdapter(),
  codex: new CodexAdapter(),
  gemini: new GeminiAdapter(),
  generic: new GenericAdapter(),
};

export function getAdapter(agent: AgentId): AgentAdapter {
  const adapter = ADAPTERS[agent];
  if (!adapter) throw new Error(`Unknown agent: ${agent}`);
  return adapter;
}

export function listAgents(): AgentId[] {
  return Object.keys(ADAPTERS) as AgentId[];
}

export function isAgentId(value: string): value is AgentId {
  return value in ADAPTERS;
}
