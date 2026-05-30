import type { SkillCandidate } from "../types.js";
import { GithubSource } from "../sources/githubSource.js";
import type { SourceRegistry } from "../sources/source.js";

/**
 * Resolve a user-provided skill reference into a SkillCandidate.
 * Accepts:
 *   - a full candidate id:           "catalog:react-best-practices"
 *   - a catalog skill name:          "react-best-practices"
 *   - a github ref:                  "owner/repo" or "owner/repo/subPath" or "owner/repo@rev"
 */
export async function resolveCandidate(
  registry: SourceRegistry,
  ref: string,
  opts: { offline?: boolean } = {}
): Promise<SkillCandidate | null> {
  const { candidates } = await registry.listAll({ offline: opts.offline });

  // 1. Exact id match.
  const byId = candidates.find((c) => c.id === ref);
  if (byId) return byId;

  // 2. Catalog name match.
  const byName = candidates.find((c) => c.name === ref);
  if (byName) return byName;

  // 3. GitHub ref (owner/repo[/sub][@rev]) — only when online.
  if (!opts.offline && /^[\w.-]+\/[\w.-]+/.test(ref)) {
    return GithubSource.candidateFromRef(ref);
  }

  return null;
}
