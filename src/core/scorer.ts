import type {
  CapabilityNeed,
  QualitySignals,
  SkillCandidate,
} from "../types.js";

/**
 * Relevance scoring between a set of capability needs and a skill candidate.
 * Combines lexical overlap (tags/description/name vs need keywords) with quality
 * signals (installs, stars, reputation) into a single 0..1 score.
 */

export interface ScoredCandidate {
  candidate: SkillCandidate;
  relevance: number; // 0..1 pure text relevance
  quality: number; // 0..1 normalized quality
  score: number; // blended final
  matchedNeeds: string[];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/)
    .filter((t) => t.length > 1);
}

/** Normalize quality signals to 0..1. */
export function qualityScore(signals: QualitySignals): number {
  const installs = signals.installs ?? 0;
  const stars = signals.stars ?? 0;
  const reputation = signals.reputation ?? 0.5;

  // Log-scale installs/stars so a few huge skills don't dominate everything.
  const installScore = Math.min(1, Math.log10(installs + 1) / 6); // 1e6 -> 1.0
  const starScore = Math.min(1, Math.log10(stars + 1) / 4); // 1e4 -> 1.0

  // Weighted blend.
  return clamp01(0.45 * installScore + 0.2 * starScore + 0.35 * reputation);
}

/** Relevance of a candidate to a single need (0..1). */
function relevanceToNeed(need: CapabilityNeed, candidate: SkillCandidate): number {
  const needTerms = new Set([
    need.id.toLowerCase(),
    ...need.keywords.map((k) => k.toLowerCase()),
    ...tokenize(need.label),
  ]);

  const tagSet = new Set(candidate.tags.map((t) => t.toLowerCase()));
  const descTokens = new Set(tokenize(candidate.description));
  const nameTokens = new Set(tokenize(candidate.name));

  let score = 0;
  for (const term of needTerms) {
    if (term.length < 2) continue;
    if (tagSet.has(term)) score += 1.0; // tag match is strongest
    else if (nameTokens.has(term)) score += 0.7;
    else if (descTokens.has(term)) score += 0.4;
    else if (hasMeaningfulPartial(term, tagSet)) {
      score += 0.3; // partial tag overlap (guarded against tiny substrings)
    }
  }

  // Normalize by a soft cap so multiple weak matches still help but saturate.
  return clamp01(score / 2);
}

/**
 * Partial overlap that avoids accidental substrings (e.g. "ai" inside "tailwind").
 * Only counts when both strings are reasonably long and one is a prefix/suffix
 * of the other.
 */
function hasMeaningfulPartial(term: string, tagSet: Set<string>): boolean {
  if (term.length < 4) return false;
  for (const tag of tagSet) {
    if (tag.length < 4) continue;
    if (tag.startsWith(term) || term.startsWith(tag)) return true;
    if (tag.endsWith(term) || term.endsWith(tag)) return true;
  }
  return false;
}

/** Score one candidate against all needs. */
export function scoreCandidate(
  needs: CapabilityNeed[],
  candidate: SkillCandidate
): ScoredCandidate {
  const matched: Array<{ need: string; rel: number }> = [];
  for (const need of needs) {
    const rel = relevanceToNeed(need, candidate) * (0.5 + 0.5 * need.confidence);
    if (rel > 0.05) matched.push({ need: need.id, rel });
  }

  // Aggregate: best match dominates, additional matches add diminishing value.
  matched.sort((a, b) => b.rel - a.rel);
  let relevance = 0;
  let weight = 1;
  for (const m of matched) {
    relevance += m.rel * weight;
    weight *= 0.5;
  }
  relevance = clamp01(relevance);

  const quality = qualityScore(candidate.signals);
  // Relevance gates the result; quality is a secondary booster.
  const score = clamp01(relevance * (0.7 + 0.3 * quality));

  return {
    candidate,
    relevance,
    quality,
    score,
    matchedNeeds: matched.map((m) => m.need),
  };
}

/** Score and rank all candidates; drop zero-relevance unless keepAll. */
export function rankCandidates(
  needs: CapabilityNeed[],
  candidates: SkillCandidate[],
  opts: { keepAll?: boolean } = {}
): ScoredCandidate[] {
  const scored = candidates.map((c) => scoreCandidate(needs, c));
  const filtered = opts.keepAll ? scored : scored.filter((s) => s.relevance > 0.05);
  return filtered.sort((a, b) => b.score - a.score);
}

/** Free-text search ranking (query string instead of structured needs). */
export function rankByQuery(
  query: string,
  candidates: SkillCandidate[]
): ScoredCandidate[] {
  const pseudoNeed: CapabilityNeed = {
    id: query.toLowerCase().trim(),
    label: query,
    source: "intent",
    confidence: 1,
    keywords: tokenize(query),
  };
  return rankCandidates([pseudoNeed], candidates);
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
