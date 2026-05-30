/**
 * SkillForge public API surface (for programmatic use as a library).
 */
export * from "./types.js";
export { scanProject } from "./core/scanner.js";
export { analyzeIntent, mergeNeeds } from "./core/intent.js";
export { buildPlan, detectConflicts } from "./core/planner.js";
export { rankCandidates, rankByQuery, scoreCandidate, qualityScore } from "./core/scorer.js";
export { auditSkill, auditFile, maxRisk } from "./core/auditor.js";
export { lintSkill, lintManifest } from "./core/linter.js";
export { installSkill, AuditBlockedError, QualityBlockedError } from "./core/installer.js";
export { buildRegistry, materializeCandidate } from "./core/registry.js";
export { readLockfile, writeLockfile } from "./core/lockfile.js";
export { getAdapter, listAgents, isAgentId } from "./agents/adapter.js";
export { parseSkillManifest, parseFrontmatter, stringifySkill } from "./util/frontmatter.js";
export * as service from "./core/service.js";
export { TOOLS as mcpTools, findTool as findMcpTool } from "./mcp/tools.js";
export { startMcpServer } from "./mcp/server.js";
export {
  installPlugin,
  uninstallPlugin,
  pluginStatus,
} from "./plugin/installer.js";
export {
  listPluginAgents,
  isPluginAgent,
  getIntegration,
} from "./plugin/manifests.js";
