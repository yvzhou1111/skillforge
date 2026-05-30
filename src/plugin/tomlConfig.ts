/**
 * Surgical TOML editor for Codex `config.toml`.
 *
 * Codex stores MCP servers as TOML tables: `[mcp_servers.<name>]` with
 * `command` and `args` keys. A Codex config typically holds many other settings
 * and comments, so we must NOT round-trip-parse the whole file (that would drop
 * comments and reorder keys). Instead we operate at the block level: locate the
 * `[mcp_servers.skillforge]` table by its header and replace/insert/remove only
 * that block, leaving everything else byte-for-byte intact.
 */
import type { McpServerEntry } from "./manifests.js";

const SERVER_NAME = "skillforge";

/** Render the SkillForge MCP entry as a TOML table block. */
function renderTomlBlock(entry: McpServerEntry): string {
  const lines: string[] = [`[mcp_servers.${SERVER_NAME}]`];
  lines.push(`command = ${tomlString(entry.command)}`);
  lines.push(`args = ${tomlStringArray(entry.args)}`);
  if (entry.env && Object.keys(entry.env).length > 0) {
    lines.push(`env = ${tomlInlineTable(entry.env)}`);
  }
  return lines.join("\n") + "\n";
}

function tomlString(s: string): string {
  return JSON.stringify(s); // TOML basic strings use the same escaping as JSON
}

function tomlStringArray(arr: string[]): string {
  return "[" + arr.map(tomlString).join(", ") + "]";
}

function tomlInlineTable(obj: Record<string, string>): string {
  const parts = Object.entries(obj).map(([k, v]) => `${tomlKey(k)} = ${tomlString(v)}`);
  return "{ " + parts.join(", ") + " }";
}

function tomlKey(k: string): string {
  return /^[A-Za-z0-9_-]+$/.test(k) ? k : JSON.stringify(k);
}

/** Match the header line of a top-level table, e.g. `[mcp_servers.skillforge]`. */
function isTableHeader(line: string): { name: string } | null {
  const m = line.match(/^\s*\[([^\[\]]+)\]\s*$/);
  if (!m) return null;
  return { name: m[1].trim() };
}

/** Match an array-of-tables header `[[...]]` so we don't confuse it with `[...]`. */
function isArrayTableHeader(line: string): boolean {
  return /^\s*\[\[[^\]]+\]\]\s*$/.test(line);
}

const SKILLFORGE_HEADER = `mcp_servers.${SERVER_NAME}`;
// Also accept the quoted form `mcp_servers."skillforge"`.
const SKILLFORGE_HEADER_QUOTED = `mcp_servers."${SERVER_NAME}"`;

function isSkillForgeHeader(name: string): boolean {
  return name === SKILLFORGE_HEADER || name === SKILLFORGE_HEADER_QUOTED;
}

interface BlockSpan {
  /** Line index of the header (inclusive). */
  start: number;
  /** Line index after the last line of the block (exclusive). */
  end: number;
}

/**
 * Find the span of the `[mcp_servers.skillforge]` table: from its header line up
 * to (but not including) the next table header or EOF.
 */
function findBlock(lines: string[]): BlockSpan | null {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isArrayTableHeader(lines[i])) continue;
    const header = isTableHeader(lines[i]);
    if (header && isSkillForgeHeader(header.name)) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (isArrayTableHeader(lines[i]) || isTableHeader(lines[i])) {
      end = i;
      break;
    }
  }
  // Trim trailing blank lines that belong to the block (keep one separator).
  return { start, end };
}

export interface TomlMergeOutcome {
  content: string;
  alreadyPresent: boolean;
}

/**
 * Insert or replace the `[mcp_servers.skillforge]` table in TOML content.
 * Preserves all other content and comments.
 */
export function upsertTomlMcpBlock(raw: string | null, entry: McpServerEntry): TomlMergeOutcome {
  const block = renderTomlBlock(entry);

  if (!raw || raw.trim() === "") {
    return { content: block, alreadyPresent: false };
  }

  const lines = raw.split("\n");
  const span = findBlock(lines);

  if (!span) {
    // Append a new block, ensuring a blank line separator.
    const trimmed = raw.replace(/\s*$/, "");
    return {
      content: `${trimmed}\n\n${block}`,
      alreadyPresent: false,
    };
  }

  // Replace existing block in place.
  const before = lines.slice(0, span.start);
  const after = lines.slice(span.end);
  // block already ends with a newline; join carefully.
  const blockLines = block.replace(/\n$/, "").split("\n");
  const merged = [...before, ...blockLines, ...after].join("\n");
  return { content: ensureTrailingNewline(merged), alreadyPresent: true };
}

/**
 * Remove the `[mcp_servers.skillforge]` table from TOML content.
 * Returns null if the block was not present.
 */
export function removeTomlMcpBlock(raw: string): string | null {
  const lines = raw.split("\n");
  const span = findBlock(lines);
  if (!span) return null;

  // Also drop a single trailing blank line left behind, if any.
  let end = span.end;
  // Drop preceding blank line so we don't accumulate gaps.
  let start = span.start;
  if (start > 0 && lines[start - 1].trim() === "") {
    start -= 1;
  }
  void end;

  const before = lines.slice(0, start);
  const after = lines.slice(span.end);
  const merged = [...before, ...after].join("\n");
  return ensureTrailingNewline(merged.replace(/\n{3,}/g, "\n\n"));
}

function ensureTrailingNewline(s: string): string {
  return s.endsWith("\n") ? s : s + "\n";
}
