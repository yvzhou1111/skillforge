import type { MaterializedSkill, SkillCandidate } from "../types.js";
import { CatalogSource } from "../sources/catalogSource.js";
import { GithubSource } from "../sources/githubSource.js";
import { SourceRegistry } from "../sources/source.js";

export interface BuildRegistryOptions {
  offline?: boolean;
  githubToken?: string;
  catalogPath?: string;
}

/** Build a SourceRegistry with the default sources wired up. */
export function buildRegistry(opts: BuildRegistryOptions = {}): SourceRegistry {
  const registry = new SourceRegistry();
  registry.register(new CatalogSource(opts.catalogPath));
  if (!opts.offline) {
    registry.register(new GithubSource(opts.githubToken));
  }
  return registry;
}

/**
 * Materialize a candidate, preferring the online GitHub source for github
 * locations (to fetch real upstream files) and falling back to the catalog's
 * synthesized stub when offline or on failure.
 */
export async function materializeCandidate(
  registry: SourceRegistry,
  candidate: SkillCandidate,
  opts: { offline?: boolean } = {}
): Promise<MaterializedSkill> {
  // If the candidate came from the catalog but points at GitHub, try GitHub first.
  if (!opts.offline && candidate.location.kind === "github") {
    const gh = registry.get("github");
    if (gh) {
      try {
        return await gh.materialize(candidate);
      } catch {
        // fall through to source-of-origin
      }
    }
  }

  const origin = registry.get(candidate.sourceId);
  if (origin) {
    return origin.materialize(candidate);
  }

  // Last resort: catalog can synthesize from metadata.
  const catalog = registry.get("catalog");
  if (catalog) return catalog.materialize(candidate);

  throw new Error(`No source available to materialize ${candidate.id}`);
}
