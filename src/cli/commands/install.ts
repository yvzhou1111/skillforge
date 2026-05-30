import path from "node:path";
import type { AgentId, InstallScope } from "../../types.js";
import { isAgentId } from "../../agents/adapter.js";
import {
  AuditBlockedError,
  QualityBlockedError,
  installSkill,
} from "../../core/installer.js";
import { buildRegistry, materializeCandidate } from "../../core/registry.js";
import { c, log } from "../../util/log.js";
import type { ParsedArgs } from "../args.js";
import { getBool, getNumber, getString } from "../args.js";
import { confirm } from "../prompt.js";
import { renderAudit, renderLint } from "../render.js";
import { resolveCandidate } from "../resolve.js";

export async function cmdInstall(args: ParsedArgs): Promise<number> {
  const ref = args._[0];
  if (!ref) {
    log.error("Usage: skillforge install <skill-id|owner/repo> --agent <agent>");
    return 1;
  }

  const agentRaw = getString(args, ["agent", "a"], "claude-code")!;
  if (!isAgentId(agentRaw)) {
    log.error(`Unknown agent "${agentRaw}". Valid: claude-code, cursor, codex, gemini, generic.`);
    return 1;
  }
  const agent = agentRaw as AgentId;
  const scope: InstallScope = getBool(args, ["global", "g"]) ? "global" : "project";
  const root = path.resolve(getString(args, ["path", "p"]) ?? process.cwd());
  const offline = getBool(args, ["offline"]);
  const skipAudit = getBool(args, ["skip-audit"]);
  const force = getBool(args, ["force", "f"]);
  const yes = getBool(args, ["yes", "y"]);
  const overwrite = getBool(args, ["overwrite"]);
  const minQuality = getNumber(args, ["min-quality"]);

  const registry = buildRegistry({ offline, githubToken: process.env.GITHUB_TOKEN });
  const candidate = await resolveCandidate(registry, ref, { offline });
  if (!candidate) {
    log.error(`Could not resolve skill: ${ref}`);
    return 1;
  }

  log.step(`Fetching ${c.green(candidate.name)} from ${candidate.location.kind}...`);
  let materialized;
  try {
    materialized = await materializeCandidate(registry, candidate, { offline });
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  try {
    const result = await installSkill(materialized, { candidate, agent, scope, projectRoot: root }, {
      skipAudit,
      force,
      overwrite,
      minQuality,
    });

    if (!skipAudit && result.audit.findings.length > 0) {
      renderAudit(result.audit);
    }
    if (!result.lint.highQuality) {
      renderLint(result.lint);
    }
    log.ok(`Installed ${c.green(candidate.name)} → ${c.dim(result.installedPath)} (${agent}, ${scope}, quality ${result.lint.grade})`);
    return 0;
  } catch (err) {
    if (err instanceof AuditBlockedError) {
      renderAudit(err.report);
      log.warn(
        `Installation blocked by audit (max risk: ${err.report.maxLevel}).`
      );
      const proceed = yes
        ? false
        : await confirm(c.red("Install anyway despite high-risk findings?"), false);
      if (!proceed) {
        log.info("Aborted. Re-run with --force to override, or --skip-audit to bypass auditing.");
        return 2;
      }
      const result = await installSkill(
        materialized,
        { candidate, agent, scope, projectRoot: root },
        { skipAudit, force: true, overwrite }
      );
      log.ok(`Force-installed ${candidate.name} → ${result.installedPath}`);
      return 0;
    }
    if (err instanceof QualityBlockedError) {
      renderLint(err.report);
      log.warn(
        `Installation blocked by quality gate (score ${err.report.score}/100, grade ${err.report.grade}, below ${err.threshold}).`
      );
      log.info("Re-run with --force to install anyway, or pick a higher-quality skill.");
      return 2;
    }
    log.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}
