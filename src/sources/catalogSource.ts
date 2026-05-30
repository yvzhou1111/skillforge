import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  MaterializedSkill,
  QualitySignals,
  SkillCandidate,
  SkillLocation,
} from "../types.js";
import { parseSkillManifest, stringifySkill } from "../util/frontmatter.js";
import { readTextIfExists } from "../util/fsx.js";
import type { Source } from "./source.js";

interface CatalogEntry {
  name: string;
  description: string;
  tags: string[];
  location: SkillLocation;
  signals?: QualitySignals;
}

interface CatalogFile {
  updatedAt?: string;
  skills: CatalogEntry[];
}

/**
 * The built-in catalog source. Offline-capable: it serves curated metadata and
 * can materialize a placeholder SKILL.md from that metadata when the real files
 * are not locally available. Real fetching is delegated to the GitHub source
 * when online; this source guarantees the tool works with zero network.
 */
export class CatalogSource implements Source {
  readonly id = "catalog";
  readonly label = "Built-in curated catalog";
  readonly online = false;

  private cache: SkillCandidate[] | null = null;
  private entriesByName = new Map<string, CatalogEntry>();

  constructor(private readonly catalogPath?: string) {}

  private resolveCatalogPath(): string {
    if (this.catalogPath) return this.catalogPath;
    // dist/sources/catalogSource.js -> ../../catalog/catalog.json
    const here = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(here, "..", "..", "catalog", "catalog.json");
  }

  async list(): Promise<SkillCandidate[]> {
    if (this.cache) return this.cache;
    const raw = await readTextIfExists(this.resolveCatalogPath());
    if (!raw) {
      this.cache = [];
      return this.cache;
    }
    const data = JSON.parse(raw) as CatalogFile;
    const candidates: SkillCandidate[] = [];
    for (const entry of data.skills ?? []) {
      this.entriesByName.set(entry.name, entry);
      const locRef =
        entry.location.kind === "github"
          ? `${entry.location.ref}${entry.location.subPath ? "/" + entry.location.subPath : ""}`
          : entry.location.ref;
      candidates.push({
        id: `${this.id}:${entry.name}`,
        name: entry.name,
        description: entry.description,
        sourceId: this.id,
        location: entry.location,
        signals: entry.signals ?? {},
        tags: entry.tags ?? [],
      });
      void locRef;
    }
    this.cache = candidates;
    return candidates;
  }

  async materialize(candidate: SkillCandidate): Promise<MaterializedSkill> {
    // Ensure metadata is loaded.
    if (this.entriesByName.size === 0) await this.list();
    const entry = this.entriesByName.get(candidate.name);

    // If the catalog points at a local path, read it directly.
    if (entry?.location.kind === "local") {
      const dir = entry.location.ref;
      const skillMd = await readTextIfExists(path.join(dir, "SKILL.md"));
      if (skillMd) {
        const manifest = parseSkillManifest(skillMd, candidate.name);
        const files = await readLocalSkillFiles(dir);
        return { manifest, files, candidate };
      }
    }

    // Otherwise synthesize a SKILL.md from curated metadata. This keeps the
    // tool fully functional offline; online installs use the GitHub source.
    const body = buildSynthesizedBody(candidate, entry);
    const skillMd = stringifySkill({
      name: candidate.name,
      description: candidate.description,
      body,
    });
    const manifest = parseSkillManifest(skillMd, candidate.name);
    return {
      manifest,
      files: { "SKILL.md": skillMd },
      candidate,
    };
  }
}

function buildSynthesizedBody(
  candidate: SkillCandidate,
  entry?: CatalogEntry
): string {
  const loc = entry?.location ?? candidate.location;
  const sourceRef =
    loc.kind === "github"
      ? `https://github.com/${loc.ref}${loc.subPath ? "/tree/main/" + loc.subPath : ""}`
      : loc.ref;
  return [
    `# ${candidate.name}`,
    "",
    candidate.description,
    "",
    "## When to use",
    "",
    `Use this skill for tasks related to: ${candidate.tags.join(", ")}.`,
    "",
    "## Source",
    "",
    `This skill is curated by SkillForge from: ${sourceRef}`,
    "",
    "> Note: This is a SkillForge-synthesized stub generated from catalog metadata",
    "> (offline mode). Run with network access and a GitHub source enabled to fetch",
    "> the upstream skill files verbatim.",
    "",
  ].join("\n");
}

async function readLocalSkillFiles(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  async function walk(d: string, rel: string): Promise<void> {
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.join(d, e.name);
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        await walk(abs, relPath);
      } else if (e.isFile()) {
        try {
          out[relPath] = await fs.readFile(abs, "utf8");
        } catch {
          // skip binary/unreadable
        }
      }
    }
  }
  await walk(dir, "");
  return out;
}
