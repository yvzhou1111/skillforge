import path from "node:path";
import type { AgentId, InstallScope } from "../../types.js";
import { isAgentId } from "../../agents/adapter.js";
import { auditSkill } from "../../core/auditor.js";
import { AuditBlockedError, installSkill } from "../../core/installer.js";
import { buildPlan } from "../../core/planner.js";
import { buildRegistry, materializeCandidate } from "../../core/registry.js";
import { c, log } from "../../util/log.js";
import type { ParsedArgs } from "../args.js";
import { getBool, getNumber, getString } from "../args.js";
import { resolveNeeds } from "../needs.js";
import { confirm } from "../prompt.js";
import { renderAudit, renderNeeds, renderPlan } from "../render.js";

/**
 * End-to-end pipeline: scan + intent -> plan -> audit -> install.
 * This is the flagship "do it all" command.
 */
export async function cmdAuto(args: ParsedArgs): Promise<number> {
  const intent = args._.join(" ").trim() || getString(args, ["intent", "i"]);
  const root = path.resolve(getString(args, ["path", "p"]) ?? process.cwd());
  const agentRaw = getString(args, ["agent", "a"], "claude-code")!;
  if (!isAgentId(agentRaw)) {
    log.error(`Unknown agent "${agentRaw}".`);
    return 1;
  }
  const agent = agentRaw as AgentId;
  const scope: InstallScope = getBool(args, ["global", "g"]) ? "global" : "project";
  const offline = getBool(args, ["offline"]);
  const noScan = getBool(args, ["no-scan"]);
  const noLLM = getBool(args, ["no-llm"]);
  const yes = getBool(args, ["yes", "y"]);
  const dryRun = getBool(args, ["dry-run"]);
  const overwrite = getBool(args, ["overwrite"]);
  const limit = getNumber(args, ["limit", "n"], 6) ?? 6;

  // 1. Needs
  log.step("Step 1/4 — Understanding your needs");
  const needs = await resolveNeeds({ projectRoot: root, intent, noScan, noLLM });
  if (needs.length === 0) {
    log.warn('No needs detected. Try: skillforge auto "build a REST API with auth and tests"');
    return 1;
  }
  renderNeeds(needs);

  // 2. Plan
  log.step("\nStep 2/4 — Planning a skill combination");
  const registry = buildRegistry({ offline, githubToken: process.env.GITHUB_TOKEN });
  const { candidates, failures } = await registry.listAll({ offline });
  for (const f of failures) log.warn(`Source "${f.sourceId}" failed: ${f.error}`);
  const plan = buildPlan(needs, candidates, { limit });
  renderPlan(plan);

  if (plan.recommendations.length === 0) {
    log.warn("No matching skills to install.");
    return 0;
  }

  // 3. Confirm
  if (dryRun) {
    log.info(c.dim("\nDry run: nothing was installed."));
    return 0;
  }
  log.step(`\nStep 3/4 — Review & confirm (target: ${agent}/${scope})`);
  const proceed = yes
    ? true
    : await confirm(`Install these ${plan.recommendations.length} skill(s)?`, true);
  if (!proceed) {
    log.info("Aborted.");
    return 0;
  }

  // 4. Audit + install each
  log.step("\nStep 4/4 — Auditing & installing");
  let installed = 0;
  let blocked = 0;
  let failed = 0;

  for (const rec of plan.recommendations) {
    try {
      const materialized = await materializeCandidate(registry, rec.candidate, { offline });
      const report = auditSkill(materialized);

      if (report.blocked) {
        renderAudit(report);
        const ok = yes
          ? false
          : await confirm(c.red(`"${rec.candidate.name}" has high-risk findings. Install anyway?`), false);
        if (!ok) {
          blocked++;
          log.warn(`Skipped ${rec.candidate.name} (blocked by audit).`);
          continue;
        }
      }

      const result = await installSkill(
        materialized,
        { candidate: rec.candidate, agent, scope, projectRoot: root },
        { force: report.blocked, overwrite }
      );
      installed++;
      log.ok(`${c.green(rec.candidate.name)} → ${c.dim(result.installedPath)}`);
    } catch (err) {
      if (err instanceof AuditBlockedError) {
        blocked++;
        log.warn(`Skipped ${rec.candidate.name} (blocked by audit).`);
        continue;
      }
      failed++;
      log.error(`Failed ${rec.candidate.name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  log.raw("");
  log.info(
    `Done. ${c.green(`${installed} installed`)}, ${blocked} skipped (risk), ${failed} failed.`
  );
  if (installed > 0) {
    log.info(c.dim("Review installed skills: skillforge list"));
  }
  return failed > 0 ? 1 : 0;
}
