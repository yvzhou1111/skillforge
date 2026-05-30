/**
 * Skill quality linter. Evaluates a SKILL.md against the AgentSkills authoring
 * conventions and content-quality heuristics, producing a graded score (A–F).
 *
 * This complements the security auditor: the auditor answers "is it safe?",
 * the linter answers "is it good?". Both feed into plan/install gating.
 */
import type { MaterializedSkill, SkillManifest } from "../types.js";

export type QualityGrade = "A" | "B" | "C" | "D" | "F";

export type LintSeverity = "error" | "warning" | "info";

export interface LintFinding {
  ruleId: string;
  severity: LintSeverity;
  message: string;
  /** Points deducted from 100 for this finding. */
  penalty: number;
}

export interface LintReport {
  skillName: string;
  /** 0..100 quality score. */
  score: number;
  grade: QualityGrade;
  findings: LintFinding[];
  /** Convenience: true if grade is A or B. */
  highQuality: boolean;
}

// Recommended bounds (chars) for description and body.
const DESC_MIN = 40;
const DESC_MAX = 1024;
const BODY_MIN = 200;
const BODY_MAX = 50_000;

// Words that signal the description states WHEN to use the skill (good triggering).
const TRIGGER_HINTS = [
  "use when",
  "use this",
  "when the user",
  "when you",
  "helps",
  "for tasks",
  "should be used",
  "apply when",
];

// Section headings that indicate a well-structured skill body.
const STRUCTURE_HINTS = [
  "when to use",
  "usage",
  "instructions",
  "examples",
  "example",
  "steps",
  "workflow",
  "how to",
];

function gradeFor(score: number): QualityGrade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

/** Lint a parsed manifest (frontmatter + body). */
export function lintManifest(
  manifest: SkillManifest,
  files: Record<string, string> = {}
): LintReport {
  const findings: LintFinding[] = [];
  const add = (
    ruleId: string,
    severity: LintSeverity,
    message: string,
    penalty: number
  ) => findings.push({ ruleId, severity, message, penalty });

  const name = manifest.name ?? "";
  const description = (manifest.description ?? "").trim();
  const body = (manifest.body ?? "").trim();
  const bodyLower = body.toLowerCase();
  const descLower = description.toLowerCase();

  // --- frontmatter: name ---
  if (!name) {
    add("LQ001-name-missing", "error", "Missing 'name' in frontmatter.", 40);
  } else if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    add(
      "LQ002-name-format",
      "warning",
      `Name "${name}" should be lowercase kebab-case (a-z, 0-9, hyphen).`,
      8
    );
  }

  // --- frontmatter: description ---
  if (!description) {
    add("LQ010-desc-missing", "error", "Missing 'description' in frontmatter.", 35);
  } else {
    if (description.length < DESC_MIN) {
      add(
        "LQ011-desc-short",
        "warning",
        `Description is very short (${description.length} chars). A good description states what the skill does AND when to use it.`,
        12
      );
    }
    if (description.length > DESC_MAX) {
      add(
        "LQ012-desc-long",
        "warning",
        `Description is very long (${description.length} chars); keep it concise — it is always loaded into context.`,
        6
      );
    }
    if (!TRIGGER_HINTS.some((h) => descLower.includes(h))) {
      add(
        "LQ013-desc-no-trigger",
        "warning",
        "Description does not clearly state WHEN to use the skill (e.g. 'Use when...'), which hurts triggering accuracy.",
        10
      );
    }
  }

  // --- body: presence & length ---
  if (!body) {
    add("LQ020-body-missing", "error", "SKILL.md has no instructional body.", 45);
  } else {
    if (body.length < BODY_MIN) {
      add(
        "LQ021-body-thin",
        "warning",
        `Body is thin (${body.length} chars); add concrete instructions and examples.`,
        12
      );
    }
    if (body.length > BODY_MAX) {
      add(
        "LQ022-body-bloat",
        "info",
        `Body is large (${body.length} chars); consider moving detail into bundled reference files (progressive disclosure).`,
        4
      );
    }
    // structure
    if (!STRUCTURE_HINTS.some((h) => bodyLower.includes(h))) {
      add(
        "LQ023-no-structure",
        "warning",
        "Body lacks recognizable sections (When to use / Instructions / Examples). Structure improves reliability.",
        8
      );
    }
    // headings
    if (!/^#{1,6}\s+/m.test(body)) {
      add(
        "LQ024-no-headings",
        "info",
        "Body has no Markdown headings; use headings to organize instructions.",
        3
      );
    }
    // examples
    if (!/\bexample\b/i.test(body) && !body.includes("```")) {
      add(
        "LQ025-no-examples",
        "info",
        "No examples or code blocks found; concrete examples improve skill performance.",
        5
      );
    }
  }

  // --- placeholders / TODO leftovers ---
  if (/\bTODO\b|\bFIXME\b|lorem ipsum|<placeholder>/i.test(`${description}\n${body}`)) {
    add(
      "LQ030-placeholder",
      "warning",
      "Contains TODO/FIXME/placeholder text; the skill looks unfinished.",
      10
    );
  }

  // --- name/description echo (low-effort description) ---
  if (description && name && descLower === name.replace(/-/g, " ")) {
    add(
      "LQ031-desc-echoes-name",
      "warning",
      "Description merely repeats the name; describe behavior and triggers instead.",
      8
    );
  }

  // --- broken-looking links (placeholder URLs) ---
  const linkMatches = body.match(/\]\(([^)]+)\)/g) ?? [];
  for (const m of linkMatches) {
    const url = m.slice(2, -1);
    if (/^https?:\/\/(example\.(com|org)|todo|changeme)/i.test(url)) {
      add(
        "LQ032-placeholder-link",
        "info",
        `Placeholder link detected: ${url}`,
        3
      );
      break;
    }
  }

  // --- multi-file checks (references/, scripts/, internal links) ---
  const fileNames = Object.keys(files).filter((f) => f !== "SKILL.md");
  const bundled = new Set(fileNames.map(normalizeRel));

  // Resolve relative internal links to bundled files; flag broken ones.
  // Runs whenever the body has internal relative links (even with no bundled files).
  const referencedMissing: string[] = [];
  for (const m of linkMatches) {
    const target = m.slice(2, -1).split("#")[0].trim();
    if (!target || /^https?:\/\//i.test(target) || target.startsWith("mailto:")) {
      continue; // external or anchor-only
    }
    if (target.startsWith("#")) continue; // pure in-page anchor
    const rel = normalizeRel(target.replace(/^\.\//, ""));
    if (!bundled.has(rel)) referencedMissing.push(target);
  }
  if (referencedMissing.length > 0) {
    add(
      "LQ040-broken-internal-link",
      "warning",
      `SKILL.md links to bundled files that are not present: ${referencedMissing
        .slice(0, 3)
        .join(", ")}${referencedMissing.length > 3 ? ", …" : ""}.`,
      Math.min(15, 5 * referencedMissing.length)
    );
  }

  if (fileNames.length > 0) {
    // Reward progressive disclosure: long body that also bundles references.
    const hasReferences = fileNames.some((f) =>
      /^(references?|reference)\//i.test(f) || /\.(md|txt)$/i.test(f)
    );
    if (body.length > 4000 && hasReferences) {
      add(
        "LQ041-progressive-disclosure",
        "info",
        "Good: large skill uses bundled reference files (progressive disclosure). +5",
        -5 // negative penalty = bonus
      );
    }

    // Flag very large bundled files (context / repo bloat).
    for (const [f, content] of Object.entries(files)) {
      if (f === "SKILL.md") continue;
      if (content.length > 200_000) {
        add(
          "LQ042-large-bundled-file",
          "info",
          `Bundled file ${f} is very large (${Math.round(content.length / 1024)} KB).`,
          3
        );
        break;
      }
    }
  }

  // Score: clamp 0..100. Bonuses (negative penalties) can lift a score but never above 100.
  const totalPenalty = findings.reduce((sum, f) => sum + f.penalty, 0);
  const score = Math.max(0, Math.min(100, 100 - totalPenalty));
  const grade = gradeFor(score);

  return {
    skillName: name || "(unnamed)",
    score,
    grade,
    findings: findings.sort((a, b) => b.penalty - a.penalty),
    highQuality: grade === "A" || grade === "B",
  };
}

/** Normalize a relative path for comparison (strip ./, collapse, lowercase drive-insensitive). */
function normalizeRel(p: string): string {
  return p.replace(/^\.\//, "").replace(/\\/g, "/").replace(/\/+/g, "/");
}

/** Lint a fully materialized skill. */
export function lintSkill(skill: MaterializedSkill): LintReport {
  return lintManifest(skill.manifest, skill.files);
}
