import type {
  AuditReport,
  CapabilityNeed,
  Plan,
  RiskLevel,
} from "../types.js";
import type { LintReport, LintSeverity, QualityGrade } from "../core/linter.js";
import { c, log } from "../util/log.js";

const RISK_COLOR: Record<RiskLevel, (s: string) => string> = {
  info: c.dim,
  low: c.blue,
  medium: c.yellow,
  high: c.red,
  critical: (s) => c.bold(c.red(s)),
};

export function renderNeeds(needs: CapabilityNeed[]): void {
  if (needs.length === 0) {
    log.warn("No capability needs detected.");
    return;
  }
  log.raw(c.bold("\nCapability needs:"));
  for (const need of needs) {
    const pct = Math.round(need.confidence * 100);
    log.raw(
      `  ${c.cyan(need.id.padEnd(18))} ${c.dim(`(${need.source}, ${pct}%)`)} ${need.label}`
    );
  }
}

export function renderPlan(plan: Plan): void {
  log.raw(c.bold("\nRecommended skills:"));
  if (plan.recommendations.length === 0) {
    log.warn("  No matching skills found for these needs.");
    return;
  }
  let i = 1;
  for (const rec of plan.recommendations) {
    const scorePct = Math.round(rec.score * 100);
    log.raw(
      `  ${c.bold(String(i).padStart(2))}. ${c.green(rec.candidate.name)} ${c.dim(
        `[${rec.candidate.sourceId}] score ${scorePct}%`
      )}`
    );
    log.raw(`      ${rec.candidate.description}`);
    log.raw(`      ${c.dim(rec.reason)}`);
    log.raw(`      ${c.dim("install: " + rec.candidate.id)}`);
    i++;
  }

  if (plan.conflicts.length > 0) {
    log.raw(c.bold(c.yellow("\nConflicts:")));
    for (const conflict of plan.conflicts) {
      log.raw(`  ${c.yellow("⚠")} ${conflict.message}`);
    }
  }
}

export function renderAudit(report: AuditReport): void {
  const color = RISK_COLOR[report.maxLevel];
  log.raw(
    `\n${c.bold("Audit:")} ${report.skillName} — max risk ${color(
      report.maxLevel.toUpperCase()
    )}${report.blocked ? c.red(" (BLOCKED)") : ""}`
  );
  if (report.findings.length === 0) {
    log.ok("  No findings.");
    return;
  }
  for (const f of report.findings) {
    const tag = RISK_COLOR[f.level](`[${f.level}]`.padEnd(11));
    log.raw(`  ${tag} ${c.dim(f.ruleId)} ${f.message}`);
    if (f.evidence) {
      log.raw(`             ${c.dim((f.file ? f.file + " " : "") + f.evidence)}`);
    }
  }
}

const GRADE_COLOR: Record<QualityGrade, (s: string) => string> = {
  A: c.green,
  B: c.green,
  C: c.yellow,
  D: c.yellow,
  F: c.red,
};

const LINT_SEV_COLOR: Record<LintSeverity, (s: string) => string> = {
  error: c.red,
  warning: c.yellow,
  info: c.dim,
};

export function renderLint(report: LintReport): void {
  const gc = GRADE_COLOR[report.grade];
  log.raw(
    `\n${c.bold("Quality:")} ${report.skillName} — grade ${gc(
      report.grade
    )} ${c.dim(`(${report.score}/100)`)}${report.highQuality ? c.green(" ✓ high quality") : ""}`
  );
  if (report.findings.length === 0) {
    log.ok("  No quality issues.");
    return;
  }
  for (const f of report.findings) {
    const tag = LINT_SEV_COLOR[f.severity](`[${f.severity}]`.padEnd(10));
    log.raw(`  ${tag} ${c.dim(f.ruleId)} ${f.message} ${c.dim(`(-${f.penalty})`)}`);
  }
}
