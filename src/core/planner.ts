import type {
  CapabilityNeed,
  Plan,
  PlanConflict,
  SkillCandidate,
  SkillRecommendation,
} from "../types.js";
import { rankCandidates, type ScoredCandidate } from "./scorer.js";

export interface PlanOptions {
  /** Maximum number of recommendations to return. */
  limit?: number;
  /** Minimum blended score required to recommend. */
  minScore?: number;
}

/**
 * Build a recommended skill combination from capability needs and candidates.
 * Deduplicates by skill name, ensures coverage across distinct needs, and flags
 * conflicts (duplicate names / overlapping capabilities).
 */
export function buildPlan(
  needs: CapabilityNeed[],
  candidates: SkillCandidate[],
  opts: PlanOptions = {}
): Plan {
  const limit = opts.limit ?? 10;
  const minScore = opts.minScore ?? 0.12;

  const ranked = rankCandidates(needs, candidates);

  // Greedy selection that prefers covering not-yet-covered needs.
  const selected: ScoredCandidate[] = [];
  const coveredNeeds = new Set<string>();
  const usedNames = new Set<string>();

  // First pass: cover each need with its best candidate.
  for (const need of needs) {
    if (selected.length >= limit) break;
    const best = ranked.find(
      (r) =>
        r.matchedNeeds.includes(need.id) &&
        r.score >= minScore &&
        !usedNames.has(r.candidate.name)
    );
    if (best && !coveredNeeds.has(best.candidate.id)) {
      selected.push(best);
      usedNames.add(best.candidate.name);
      best.matchedNeeds.forEach((n) => coveredNeeds.add(n));
    }
  }

  // Second pass: fill remaining slots with the next highest-scoring uniques.
  for (const r of ranked) {
    if (selected.length >= limit) break;
    if (r.score < minScore) break;
    if (usedNames.has(r.candidate.name)) continue;
    selected.push(r);
    usedNames.add(r.candidate.name);
  }

  selected.sort((a, b) => b.score - a.score);

  const recommendations: SkillRecommendation[] = selected.map((s) => ({
    candidate: s.candidate,
    score: round2(s.score),
    matchedNeeds: s.matchedNeeds,
    reason: buildReason(s, needs),
  }));

  const conflicts = detectConflicts(recommendations);

  return { needs, recommendations, conflicts };
}

function buildReason(s: ScoredCandidate, needs: CapabilityNeed[]): string {
  const labels = s.matchedNeeds
    .map((id) => needs.find((n) => n.id === id)?.label ?? id)
    .slice(0, 4);
  const qualityNote =
    s.quality >= 0.8
      ? "high-trust source"
      : s.quality >= 0.5
        ? "established source"
        : "community source";
  if (labels.length === 0) {
    return `General relevance to your request (${qualityNote}).`;
  }
  return `Addresses ${labels.join(", ")} (${qualityNote}, relevance ${Math.round(
    s.relevance * 100
  )}%).`;
}

/** Detect duplicate-name and overlapping-capability conflicts. */
export function detectConflicts(recs: SkillRecommendation[]): PlanConflict[] {
  const conflicts: PlanConflict[] = [];

  // Duplicate names (same skill name from different sources).
  const byName = new Map<string, SkillRecommendation[]>();
  for (const r of recs) {
    const list = byName.get(r.candidate.name) ?? [];
    list.push(r);
    byName.set(r.candidate.name, list);
  }
  for (const [name, list] of byName) {
    if (list.length > 1) {
      conflicts.push({
        kind: "duplicate-name",
        skillIds: list.map((r) => r.candidate.id),
        message: `Multiple skills named "${name}" selected from different sources; only one can install to a given path.`,
      });
    }
  }

  // Overlapping capability: more than 2 skills covering the exact same single need.
  const byNeed = new Map<string, SkillRecommendation[]>();
  for (const r of recs) {
    for (const need of r.matchedNeeds) {
      const list = byNeed.get(need) ?? [];
      list.push(r);
      byNeed.set(need, list);
    }
  }
  for (const [need, list] of byNeed) {
    if (list.length >= 3) {
      conflicts.push({
        kind: "overlapping-capability",
        skillIds: list.map((r) => r.candidate.id),
        message: `${list.length} skills overlap on "${need}"; consider keeping only the top one to reduce context bloat.`,
      });
    }
  }

  return conflicts;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
