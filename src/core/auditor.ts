import type {
  AuditFinding,
  AuditReport,
  MaterializedSkill,
  RiskLevel,
} from "../types.js";

/**
 * Static security auditor for skills. Scans SKILL.md and any bundled scripts
 * for dangerous patterns before installation. This is SkillForge's core
 * differentiator: skills can execute scripts and write hooks, which is a real
 * attack surface most installers ignore.
 */

interface Rule {
  id: string;
  level: RiskLevel;
  /** Files this rule applies to (by extension or name). "*" for all. */
  applies: (file: string) => boolean;
  pattern: RegExp;
  message: string;
}

const SCRIPT_EXT = /\.(sh|bash|zsh|py|js|ts|rb|ps1|bat|cmd)$/i;
const isScript = (f: string) => SCRIPT_EXT.test(f);
const isAny = () => true;
const isMarkdownOrScript = (f: string) => /\.md$/i.test(f) || isScript(f);

const RULES: Rule[] = [
  {
    id: "SF001-rm-rf",
    level: "high",
    applies: isMarkdownOrScript,
    pattern: /\brm\s+-rf?\b|\brm\s+-[a-z]*f[a-z]*\s+\//i,
    message: "Recursive force file deletion (rm -rf) detected.",
  },
  {
    id: "SF002-curl-pipe-sh",
    level: "critical",
    applies: isMarkdownOrScript,
    pattern: /\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(sh|bash|zsh)\b/i,
    message: "Piping a downloaded script directly into a shell (curl | sh) — remote code execution risk.",
  },
  {
    id: "SF003-sudo",
    level: "high",
    applies: isMarkdownOrScript,
    pattern: /\bsudo\b/i,
    message: "Privilege escalation via sudo detected.",
  },
  {
    id: "SF004-chmod-777",
    level: "medium",
    applies: isMarkdownOrScript,
    pattern: /\bchmod\s+(-R\s+)?0?777\b/i,
    message: "Overly permissive permissions (chmod 777) detected.",
  },
  {
    id: "SF005-eval-exec",
    level: "high",
    applies: isScript,
    pattern: /\b(eval|exec)\s*\(|\bos\.system\s*\(|\bsubprocess\.(call|run|Popen)\b|\bchild_process\b/i,
    message: "Dynamic code/command execution primitive detected.",
  },
  {
    id: "SF006-sensitive-files",
    level: "high",
    applies: isMarkdownOrScript,
    pattern: /(\.env\b|id_rsa\b|id_ed25519\b|\.ssh\/|\.aws\/credentials|\.netrc\b|secrets?\.(json|ya?ml|txt))/i,
    message: "Access to sensitive credential files detected.",
  },
  {
    id: "SF007-pretooluse-hook",
    level: "high",
    applies: isAny,
    pattern: /pre[_-]?tool[_-]?use|post[_-]?tool[_-]?use|"hooks"\s*:/i,
    message: "Skill attempts to register tool-use hooks (can intercept/alter agent actions).",
  },
  {
    id: "SF008-home-config-write",
    level: "medium",
    applies: isMarkdownOrScript,
    pattern: /(>|>>|tee|cp|mv|install)\s+[^\n]*(~\/|\$HOME\/|%USERPROFILE%)/i,
    message: "Writes files into the user's home directory / global config.",
  },
  {
    id: "SF009-data-exfil",
    level: "high",
    applies: isScript,
    pattern: /\b(curl|wget|fetch|requests\.(post|put)|axios\.(post|put)|http\.request)\b[^\n]*(https?:\/\/)/i,
    message: "Outbound network request that may transmit local data.",
  },
  {
    id: "SF010-base64-decode-exec",
    level: "critical",
    applies: isScript,
    pattern: /base64\s+(-d|--decode)[^\n]*\|\s*(sh|bash)|atob\s*\([^)]*\)\s*\)?\s*;?\s*eval/i,
    message: "Obfuscated payload (base64 decode piped to shell/eval) detected.",
  },
  {
    id: "SF011-crontab",
    level: "medium",
    applies: isMarkdownOrScript,
    pattern: /\bcrontab\b|\b(launchctl|systemctl)\s+(load|enable|start)\b/i,
    message: "Attempts to install a persistent background job/service.",
  },
  {
    id: "SF012-suspicious-domain",
    level: "low",
    applies: isMarkdownOrScript,
    pattern: /https?:\/\/[^\s/"')]*\b(pastebin\.com|bit\.ly|tinyurl\.com|ngrok\.io|webhook\.site|requestbin)/i,
    message: "Reference to a URL-shortener or ephemeral endpoint often used for exfiltration.",
  },
];

const LEVEL_ORDER: RiskLevel[] = ["info", "low", "medium", "high", "critical"];

export function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return LEVEL_ORDER.indexOf(a) >= LEVEL_ORDER.indexOf(b) ? a : b;
}

function trimEvidence(line: string): string {
  const t = line.trim();
  return t.length > 160 ? t.slice(0, 157) + "..." : t;
}

/** Audit a single file's content against all applicable rules. */
export function auditFile(file: string, content: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const lines = content.split(/\r?\n/);

  for (const rule of RULES) {
    if (!rule.applies(file)) continue;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (rule.pattern.test(line)) {
        findings.push({
          ruleId: rule.id,
          level: rule.level,
          message: rule.message,
          file,
          evidence: `L${i + 1}: ${trimEvidence(line)}`,
        });
        // Reset lastIndex for global-less regex safety; report first hit per line only.
      }
    }
  }

  return findings;
}

/** Audit an entire materialized skill (all bundled files). */
export function auditSkill(skill: MaterializedSkill): AuditReport {
  const findings: AuditFinding[] = [];
  for (const [file, content] of Object.entries(skill.files)) {
    findings.push(...auditFile(file, content));
  }

  // Informational: note presence of any script files at all.
  const scriptFiles = Object.keys(skill.files).filter(isScript);
  if (scriptFiles.length > 0) {
    findings.push({
      ruleId: "SF000-has-scripts",
      level: "info",
      message: `Skill bundles ${scriptFiles.length} executable script file(s): ${scriptFiles.join(", ")}. Review before running.`,
    });
  }

  let maxLevel: RiskLevel = "info";
  for (const f of findings) maxLevel = maxRisk(maxLevel, f.level);

  const blocked =
    LEVEL_ORDER.indexOf(maxLevel) >= LEVEL_ORDER.indexOf("high");

  return {
    skillName: skill.manifest.name,
    findings: dedupeFindings(findings),
    maxLevel,
    blocked,
  };
}

function dedupeFindings(findings: AuditFinding[]): AuditFinding[] {
  const seen = new Set<string>();
  const out: AuditFinding[] = [];
  for (const f of findings) {
    const key = `${f.ruleId}|${f.file ?? ""}|${f.evidence ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  // Sort by severity descending.
  return out.sort(
    (a, b) => LEVEL_ORDER.indexOf(b.level) - LEVEL_ORDER.indexOf(a.level)
  );
}
