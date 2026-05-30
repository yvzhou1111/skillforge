/**
 * Core domain types for SkillForge.
 */

/** A normalized capability the user/project needs (e.g. "react", "testing"). */
export interface CapabilityNeed {
  /** Canonical capability id, e.g. "react", "docker", "i18n". */
  id: string;
  /** Human label. */
  label: string;
  /** Where this need came from: dependency file, heuristic, or intent text. */
  source: "dependency" | "heuristic" | "intent";
  /** 0..1 confidence that the project actually needs this. */
  confidence: number;
  /** Free-form search keywords associated with this need. */
  keywords: string[];
}

/** Parsed SKILL.md frontmatter + body. */
export interface SkillManifest {
  name: string;
  description: string;
  /** Optional metadata commonly found in SKILL.md frontmatter. */
  license?: string;
  version?: string;
  allowedTools?: string[];
  metadata?: Record<string, unknown>;
  /** Markdown body (everything after frontmatter). */
  body: string;
}

/** A discoverable skill candidate from some Source. */
export interface SkillCandidate {
  /** Stable id: `${sourceId}:${owner}/${repo}@${name}` or `${sourceId}:${name}`. */
  id: string;
  name: string;
  description: string;
  /** Id of the Source that produced this candidate. */
  sourceId: string;
  /** Where to fetch it from (owner/repo, url, or local path). */
  location: SkillLocation;
  /** Quality signals used for ranking. */
  signals: QualitySignals;
  /** Tags / categories for matching. */
  tags: string[];
}

export interface SkillLocation {
  kind: "local" | "github" | "url";
  /** For local: absolute or relative dir. For github: "owner/repo". For url: a URL. */
  ref: string;
  /** Optional sub-path within a repo (e.g. "skills/react-best-practices"). */
  subPath?: string;
  /** Optional ref/branch/commit. */
  rev?: string;
}

export interface QualitySignals {
  installs?: number;
  stars?: number;
  /** Source reputation 0..1 (official orgs higher). */
  reputation?: number;
  /** ISO date of last update if known. */
  updatedAt?: string;
}

/** A scored recommendation produced by the planner. */
export interface SkillRecommendation {
  candidate: SkillCandidate;
  /** 0..1 final relevance after scoring + quality blend. */
  score: number;
  /** Which needs this skill addresses. */
  matchedNeeds: string[];
  /** Human-readable reason. */
  reason: string;
}

/** Result of planning over a set of needs. */
export interface Plan {
  needs: CapabilityNeed[];
  recommendations: SkillRecommendation[];
  /** Detected conflicts among recommended skills. */
  conflicts: PlanConflict[];
}

export interface PlanConflict {
  kind: "duplicate-name" | "overlapping-capability" | "path-collision";
  skillIds: string[];
  message: string;
}

/** Security audit risk levels. */
export type RiskLevel = "info" | "low" | "medium" | "high" | "critical";

export interface AuditFinding {
  ruleId: string;
  level: RiskLevel;
  message: string;
  /** File the finding was located in (relative to skill dir). */
  file?: string;
  /** Matched snippet (trimmed). */
  evidence?: string;
}

export interface AuditReport {
  skillName: string;
  findings: AuditFinding[];
  /** Highest risk level across findings. */
  maxLevel: RiskLevel;
  /** True if findings include high or critical. */
  blocked: boolean;
}

/** Supported target agents. */
export type AgentId = "claude-code" | "cursor" | "codex" | "gemini" | "generic";

export type InstallScope = "project" | "global";

export interface InstallRequest {
  candidate: SkillCandidate;
  agent: AgentId;
  scope: InstallScope;
  /** Project root (cwd) for project-scoped installs. */
  projectRoot: string;
}

export interface InstalledSkill {
  name: string;
  sourceId: string;
  location: SkillLocation;
  agent: AgentId;
  scope: InstallScope;
  /** Path the skill was written to. */
  installedPath: string;
  /** Sha256 of SKILL.md content for integrity/update checks. */
  checksum: string;
  installedAt: string;
  version?: string;
}

export interface Lockfile {
  version: 1;
  skills: InstalledSkill[];
}

/** A fully materialized skill (manifest + extra files) ready to install. */
export interface MaterializedSkill {
  manifest: SkillManifest;
  /** Map of relative path -> file content (text). Includes SKILL.md. */
  files: Record<string, string>;
  candidate: SkillCandidate;
}

/** Optional LLM provider config. */
export interface LLMConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}
