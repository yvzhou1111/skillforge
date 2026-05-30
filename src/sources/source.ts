import type { MaterializedSkill, SkillCandidate } from "../types.js";

/**
 * A Source is a pluggable provider of skill candidates plus the ability to
 * materialize (fetch the actual files of) a candidate for installation.
 */
export interface Source {
  /** Stable id, used to namespace candidate ids. */
  readonly id: string;
  /** Human label. */
  readonly label: string;
  /** Whether this source needs network access. */
  readonly online: boolean;

  /** Return all candidates this source can offer (may be cached). */
  list(): Promise<SkillCandidate[]>;

  /** Fetch the full files for a candidate so it can be installed. */
  materialize(candidate: SkillCandidate): Promise<MaterializedSkill>;
}

/** Registry that aggregates multiple sources. */
export class SourceRegistry {
  private sources: Source[] = [];

  register(source: Source): void {
    this.sources.push(source);
  }

  get(id: string): Source | undefined {
    return this.sources.find((s) => s.id === id);
  }

  all(): Source[] {
    return [...this.sources];
  }

  /** List candidates across all sources; failing sources are skipped. */
  async listAll(opts: { offline?: boolean } = {}): Promise<{
    candidates: SkillCandidate[];
    failures: Array<{ sourceId: string; error: string }>;
  }> {
    const candidates: SkillCandidate[] = [];
    const failures: Array<{ sourceId: string; error: string }> = [];

    for (const source of this.sources) {
      if (opts.offline && source.online) continue;
      try {
        const list = await source.list();
        candidates.push(...list);
      } catch (err) {
        failures.push({
          sourceId: source.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { candidates, failures };
  }
}
