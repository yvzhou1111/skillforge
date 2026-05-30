/**
 * High-level service layer shared by the CLI and the MCP server.
 * Each function returns plain, serializable data so it can be rendered in a
 * terminal or returned as an MCP tool result without duplicating logic.
 */
import type {
  AgentId,
  AuditReport,
  CapabilityNeed,
  InstallScope,
  Plan,
  SkillCandidate,
} from "../types.js";
import { analyzeIntent, mergeNeeds } from "./intent.js";
import { scanProject } from "./scanner.js";
import { enhanceNeedsWithLLM, resolveLLMConfig } from "./llm.js";
import { buildPlan } from "./planner.js";
import { rankByQuery, type ScoredCandidate } from "./scorer.js";
import { auditSkill } from "./auditor.js";
import { lintSkill, type LintReport } from "./linter.js";
import { AuditBlockedError, installSkill } from "./installer.js";
import { buildRegistry, materializeCandidate } from "./registry.js";
import { readLockfile } from "./lockfile.js";
import { GithubSource } from "../sources/githubSource.js";

export interface CommonOptions {
  offline?: boolean;
  githubToken?: string;
}

export interface ScanResultDTO {
  projectRoot: string;
  needs: CapabilityNeed[];
  detectedFiles: string[];
  lowConfidence: boolean;
}

export async function scan(projectRoot: string): Promise<ScanResultDTO> {
  const result = await scanProject(projectRoot);
  return { projectRoot, ...result };
}

export interface ResolveNeedsInput {
  projectRoot: string;
  intent?: string;
  noScan?: boolean;
  noLLM?: boolean;
}

/** Resolve needs from scan + intent (+ optional LLM). Offline-safe. */
export async function resolveNeeds(
  input: ResolveNeedsInput
): Promise<CapabilityNeed[]> {
  const groups: CapabilityNeed[][] = [];
  if (!input.noScan) {
    const s = await scanProject(input.projectRoot);
    groups.push(s.needs);
  }
  if (input.intent) {
    groups.push(analyzeIntent(input.intent));
  }
  let merged = mergeNeeds(...groups);

  if (!input.noLLM && input.intent) {
    const config = resolveLLMConfig();
    if (config) {
      const enhanced = await enhanceNeedsWithLLM(input.intent, merged, config);
      if (enhanced) merged = mergeNeeds(merged, enhanced);
    }
  }
  return merged;
}

export interface SearchResultItem {
  id: string;
  name: string;
  description: string;
  sourceId: string;
  score: number;
  installs?: number;
}

export async function search(
  query: string,
  opts: CommonOptions = {}
): Promise<{ results: SearchResultItem[]; failures: Array<{ sourceId: string; error: string }> }> {
  const registry = buildRegistry({ offline: opts.offline, githubToken: opts.githubToken });
  const { candidates, failures } = await registry.listAll({ offline: opts.offline });
  const ranked = rankByQuery(query, candidates);
  return {
    results: ranked.map(toSearchItem),
    failures,
  };
}

function toSearchItem(s: ScoredCandidate): SearchResultItem {
  return {
    id: s.candidate.id,
    name: s.candidate.name,
    description: s.candidate.description,
    sourceId: s.candidate.sourceId,
    score: Math.round(s.score * 100) / 100,
    installs: s.candidate.signals.installs,
  };
}

export interface PlanInput extends ResolveNeedsInput, CommonOptions {
  limit?: number;
}

export async function plan(
  input: PlanInput
): Promise<{ plan: Plan; failures: Array<{ sourceId: string; error: string }> }> {
  const needs = await resolveNeeds(input);
  const registry = buildRegistry({ offline: input.offline, githubToken: input.githubToken });
  const { candidates, failures } = await registry.listAll({ offline: input.offline });
  const result = buildPlan(needs, candidates, { limit: input.limit ?? 10 });
  return { plan: result, failures };
}

/** Resolve a user reference (id / catalog name / owner/repo) to a candidate. */
export async function resolveCandidateRef(
  ref: string,
  opts: CommonOptions = {}
): Promise<SkillCandidate | null> {
  const registry = buildRegistry({ offline: opts.offline, githubToken: opts.githubToken });
  const { candidates } = await registry.listAll({ offline: opts.offline });
  const byId = candidates.find((c) => c.id === ref);
  if (byId) return byId;
  const byName = candidates.find((c) => c.name === ref);
  if (byName) return byName;
  if (!opts.offline && /^[\w.-]+\/[\w.-]+/.test(ref)) {
    return GithubSource.candidateFromRef(ref);
  }
  return null;
}

export async function audit(
  ref: string,
  opts: CommonOptions = {}
): Promise<AuditReport> {
  const candidate = await resolveCandidateRef(ref, opts);
  if (!candidate) throw new Error(`Could not resolve skill: ${ref}`);
  const registry = buildRegistry({ offline: opts.offline, githubToken: opts.githubToken });
  const materialized = await materializeCandidate(registry, candidate, { offline: opts.offline });
  return auditSkill(materialized);
}

export async function lint(
  ref: string,
  opts: CommonOptions = {}
): Promise<LintReport> {
  const candidate = await resolveCandidateRef(ref, opts);
  if (!candidate) throw new Error(`Could not resolve skill: ${ref}`);
  const registry = buildRegistry({ offline: opts.offline, githubToken: opts.githubToken });
  const materialized = await materializeCandidate(registry, candidate, { offline: opts.offline });
  return lintSkill(materialized);
}

export interface InstallInput extends CommonOptions {
  ref: string;
  agent: AgentId;
  scope: InstallScope;
  projectRoot: string;
  skipAudit?: boolean;
  force?: boolean;
  overwrite?: boolean;
}

export interface InstallResultDTO {
  installed: boolean;
  blocked: boolean;
  installedPath?: string;
  audit: AuditReport;
  name: string;
}

export async function install(input: InstallInput): Promise<InstallResultDTO> {
  const candidate = await resolveCandidateRef(input.ref, input);
  if (!candidate) throw new Error(`Could not resolve skill: ${input.ref}`);
  const registry = buildRegistry({ offline: input.offline, githubToken: input.githubToken });
  const materialized = await materializeCandidate(registry, candidate, { offline: input.offline });

  try {
    const result = await installSkill(
      materialized,
      { candidate, agent: input.agent, scope: input.scope, projectRoot: input.projectRoot },
      { skipAudit: input.skipAudit, force: input.force, overwrite: input.overwrite }
    );
    return {
      installed: true,
      blocked: false,
      installedPath: result.installedPath,
      audit: result.audit,
      name: candidate.name,
    };
  } catch (err) {
    if (err instanceof AuditBlockedError) {
      return {
        installed: false,
        blocked: true,
        audit: err.report,
        name: candidate.name,
      };
    }
    throw err;
  }
}

export async function listInstalled(projectRoot: string) {
  const lock = await readLockfile(projectRoot);
  return lock.skills;
}
