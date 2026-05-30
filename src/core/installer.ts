import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  AuditReport,
  InstalledSkill,
  InstallRequest,
  MaterializedSkill,
} from "../types.js";
import { getAdapter } from "../agents/adapter.js";
import { ensureDir, pathExists, sha256 } from "../util/fsx.js";
import { auditSkill } from "./auditor.js";
import { lintSkill, type LintReport } from "./linter.js";
import { readLockfile, upsertSkill, writeLockfile } from "./lockfile.js";

export interface InstallResult {
  installedPath: string;
  skill: InstalledSkill;
  audit: AuditReport;
  lint: LintReport;
}

export interface InstallOptions {
  /** Skip the pre-install audit entirely. */
  skipAudit?: boolean;
  /** Proceed even if audit blocks (high/critical). Requires explicit opt-in. */
  force?: boolean;
  /** Overwrite an existing skill directory. */
  overwrite?: boolean;
  /** Minimum quality score (0..100). Below this, install is blocked unless force. */
  minQuality?: number;
}

/**
 * Write a materialized skill to disk for the target agent, after auditing and
 * quality-checking it, and record it in the project lockfile.
 *
 * Throws AuditBlockedError if the audit blocks and `force` is not set.
 * Throws QualityBlockedError if quality is below `minQuality` and not forced.
 */
export async function installSkill(
  materialized: MaterializedSkill,
  request: InstallRequest,
  opts: InstallOptions = {}
): Promise<InstallResult> {
  const audit = auditSkill(materialized);
  const lint = lintSkill(materialized);

  if (!opts.skipAudit && audit.blocked && !opts.force) {
    throw new AuditBlockedError(audit);
  }
  if (
    opts.minQuality !== undefined &&
    lint.score < opts.minQuality &&
    !opts.force
  ) {
    throw new QualityBlockedError(lint, opts.minQuality);
  }

  const adapter = getAdapter(request.agent);
  const targetDir = adapter.resolveSkillDir({
    skillName: materialized.manifest.name,
    scope: request.scope,
    projectRoot: request.projectRoot,
  });

  if ((await pathExists(targetDir)) && !opts.overwrite) {
    throw new Error(
      `Skill already installed at ${targetDir}. Use --overwrite to replace it.`
    );
  }

  await ensureDir(targetDir);
  for (const [relPath, content] of Object.entries(materialized.files)) {
    const dest = path.join(targetDir, relPath);
    await ensureDir(path.dirname(dest));
    await fs.writeFile(dest, content, "utf8");
  }

  const checksum = sha256(materialized.files["SKILL.md"] ?? "");
  const installed: InstalledSkill = {
    name: materialized.manifest.name,
    sourceId: materialized.candidate.sourceId,
    location: materialized.candidate.location,
    agent: request.agent,
    scope: request.scope,
    installedPath: targetDir,
    checksum,
    installedAt: new Date().toISOString(),
    version: materialized.manifest.version,
  };

  // Lockfile lives at the project root regardless of scope, for auditability.
  const lock = await readLockfile(request.projectRoot);
  await writeLockfile(request.projectRoot, upsertSkill(lock, installed));

  return { installedPath: targetDir, skill: installed, audit, lint };
}

export class AuditBlockedError extends Error {
  constructor(public readonly report: AuditReport) {
    super(
      `Audit blocked installation of "${report.skillName}" (max risk: ${report.maxLevel}).`
    );
    this.name = "AuditBlockedError";
  }
}

export class QualityBlockedError extends Error {
  constructor(
    public readonly report: LintReport,
    public readonly threshold: number
  ) {
    super(
      `Quality gate blocked "${report.skillName}" (score ${report.score}/100, grade ${report.grade}, below threshold ${threshold}).`
    );
    this.name = "QualityBlockedError";
  }
}
