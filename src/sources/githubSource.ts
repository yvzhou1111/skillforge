import type { MaterializedSkill, SkillCandidate, SkillLocation } from "../types.js";
import { parseSkillManifest } from "../util/frontmatter.js";
import type { Source } from "./source.js";

/** Raised when GitHub rate limits the unauthenticated client. */
export class GithubRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GithubRateLimitError";
  }
}

/**
 * Fetches skill files directly from GitHub repositories via the public REST and
 * raw endpoints. This source does not list a fixed catalog; it materializes
 * candidates whose location.kind === "github". It is primarily used to fetch
 * the upstream files for catalog candidates when online.
 */
export class GithubSource implements Source {
  readonly id = "github";
  readonly label = "GitHub (raw)";
  readonly online = true;

  constructor(private readonly token?: string) {}

  async list(): Promise<SkillCandidate[]> {
    // GitHub source is fetch-only; discovery is driven by the catalog/other
    // sources. Returning empty keeps it out of search listings.
    return [];
  }

  /** Build a candidate from an explicit owner/repo[/subPath] reference. */
  static candidateFromRef(ref: string, name?: string): SkillCandidate {
    const [ownerRepo, ...rest] = ref.split("@");
    const parts = ownerRepo.split("/");
    const owner = parts[0];
    const repo = parts[1];
    const subPath = parts.slice(2).join("/") || undefined;
    const rev = rest[0];
    const skillName = name ?? subPath?.split("/").pop() ?? repo;
    const location: SkillLocation = {
      kind: "github",
      ref: `${owner}/${repo}`,
      subPath,
      rev,
    };
    return {
      id: `github:${owner}/${repo}${subPath ? "/" + subPath : ""}`,
      name: skillName,
      description: `Skill fetched from github.com/${owner}/${repo}${subPath ? "/" + subPath : ""}`,
      sourceId: "github",
      location,
      signals: {},
      tags: [],
    };
  }

  async materialize(candidate: SkillCandidate): Promise<MaterializedSkill> {
    if (candidate.location.kind !== "github") {
      throw new Error(`GithubSource cannot materialize a ${candidate.location.kind} location`);
    }
    const { ref, subPath, rev } = candidate.location;
    const branch = rev ?? (await this.defaultBranch(ref));
    const base = subPath ? `${subPath.replace(/\/$/, "")}` : "";

    // Fetch the directory listing to know which files to pull.
    const files = await this.fetchSkillDir(ref, base, branch);

    const skillMd = files["SKILL.md"];
    if (!skillMd) {
      throw new Error(
        `No SKILL.md found at github.com/${ref}/${base || "(root)"} @ ${branch}`
      );
    }
    const manifest = parseSkillManifest(skillMd, candidate.name);
    return { manifest, files, candidate };
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "skillforge",
    };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  }

  private async defaultBranch(ownerRepo: string): Promise<string> {
    try {
      const res = await fetch(`https://api.github.com/repos/${ownerRepo}`, {
        headers: this.headers(),
      });
      if (res.ok) {
        const data = (await res.json()) as { default_branch?: string };
        if (data.default_branch) return data.default_branch;
      }
    } catch {
      // fall through
    }
    return "main";
  }

  /**
   * Recursively fetch a skill directory's text files via the GitHub contents API.
   * Returns a map of relative-path -> content (relative to the skill dir).
   */
  private async fetchSkillDir(
    ownerRepo: string,
    dirPath: string,
    branch: string,
    relPrefix = ""
  ): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    const apiUrl = `https://api.github.com/repos/${ownerRepo}/contents/${encodeURI(
      dirPath
    )}?ref=${encodeURIComponent(branch)}`;

    const res = await fetch(apiUrl, { headers: this.headers() });
    if (!res.ok) {
      if (res.status === 403 || res.status === 429) {
        const remaining = res.headers.get("x-ratelimit-remaining");
        if (remaining === "0" || res.status === 429) {
          throw new GithubRateLimitError(
            "GitHub API rate limit exceeded. Set GITHUB_TOKEN to raise the limit, or use --offline."
          );
        }
      }
      throw new Error(`GitHub API ${res.status} for ${ownerRepo}/${dirPath}`);
    }
    const items = (await res.json()) as Array<{
      name: string;
      path: string;
      type: "file" | "dir";
      download_url: string | null;
      size: number;
    }>;

    for (const item of items) {
      const relPath = relPrefix ? `${relPrefix}/${item.name}` : item.name;
      if (item.type === "dir") {
        const nested = await this.fetchSkillDir(
          ownerRepo,
          item.path,
          branch,
          relPath
        );
        Object.assign(out, nested);
      } else if (item.type === "file" && item.download_url) {
        // Skip very large or likely-binary files.
        if (item.size > 512 * 1024) continue;
        const fileRes = await fetch(item.download_url, { headers: this.headers() });
        if (!fileRes.ok) continue;
        const text = await fileRes.text();
        out[relPath] = text;
      }
    }

    return out;
  }
}
