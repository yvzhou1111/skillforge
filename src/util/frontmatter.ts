import { parse as parseYaml } from "yaml";
import type { SkillManifest } from "../types.js";

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;

export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  body: string;
}

/**
 * Split a markdown document into YAML frontmatter (object) and the remaining body.
 * Returns empty data if no frontmatter block is present.
 */
export function parseFrontmatter(content: string): ParsedFrontmatter {
  const normalized = content.replace(/^\uFEFF/, "");
  const match = normalized.match(FRONTMATTER_RE);
  if (!match) {
    return { data: {}, body: normalized.trim() };
  }
  const [, rawYaml, body] = match;
  let data: Record<string, unknown> = {};
  try {
    const parsed = parseYaml(rawYaml);
    if (parsed && typeof parsed === "object") {
      data = parsed as Record<string, unknown>;
    }
  } catch {
    // Malformed frontmatter -> treat as no metadata, keep body.
    data = {};
  }
  return { data, body: body.trim() };
}

function asStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

/**
 * Parse a full SKILL.md document into a structured manifest.
 * Throws if the required `name` field cannot be resolved.
 */
export function parseSkillManifest(content: string, fallbackName?: string): SkillManifest {
  const { data, body } = parseFrontmatter(content);

  const name =
    (typeof data.name === "string" && data.name.trim()) ||
    fallbackName ||
    "";
  if (!name) {
    throw new Error("SKILL.md is missing a 'name' field and no fallback name was provided.");
  }

  const description =
    (typeof data.description === "string" && data.description.trim()) || "";

  return {
    name,
    description,
    license: typeof data.license === "string" ? data.license : undefined,
    version: typeof data.version === "string" ? data.version : undefined,
    allowedTools:
      asStringArray(data["allowed-tools"]) ?? asStringArray(data.allowedTools),
    metadata: data,
    body,
  };
}

/** Serialize a manifest back to SKILL.md text (used by `init`). */
export function stringifySkill(manifest: Pick<SkillManifest, "name" | "description" | "body">): string {
  const fm = [
    "---",
    `name: ${manifest.name}`,
    `description: ${escapeYamlScalar(manifest.description)}`,
    "---",
    "",
  ].join("\n");
  return fm + manifest.body.trim() + "\n";
}

function escapeYamlScalar(value: string): string {
  if (/[:#\n]/.test(value)) {
    return JSON.stringify(value);
  }
  return value;
}
