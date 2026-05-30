import { describe, expect, it } from "vitest";
import { qualityScore, rankByQuery, rankCandidates, scoreCandidate } from "./scorer.js";
import type { CapabilityNeed, SkillCandidate } from "../types.js";

function candidate(
  name: string,
  tags: string[],
  installs = 0,
  reputation = 0.5
): SkillCandidate {
  return {
    id: `catalog:${name}`,
    name,
    description: `${name} skill for ${tags.join(", ")}`,
    sourceId: "catalog",
    location: { kind: "github", ref: "x/y" },
    signals: { installs, reputation },
    tags,
  };
}

const need = (id: string, keywords: string[] = []): CapabilityNeed => ({
  id,
  label: id,
  source: "intent",
  confidence: 1,
  keywords: [id, ...keywords],
});

describe("qualityScore", () => {
  it("rewards installs and reputation", () => {
    const low = qualityScore({ installs: 10, reputation: 0.4 });
    const high = qualityScore({ installs: 200000, reputation: 1 });
    expect(high).toBeGreaterThan(low);
  });
});

describe("scoreCandidate", () => {
  it("scores a tag match highly", () => {
    const s = scoreCandidate([need("react")], candidate("react-bp", ["react", "frontend"]));
    expect(s.relevance).toBeGreaterThan(0.3);
    expect(s.matchedNeeds).toContain("react");
  });

  it("gives zero relevance to unrelated candidates", () => {
    const s = scoreCandidate([need("react")], candidate("rust-skill", ["rust", "systems"]));
    expect(s.relevance).toBe(0);
  });
});

describe("rankCandidates", () => {
  it("orders relevant high-quality skills first", () => {
    const needs = [need("react", ["frontend"])];
    const candidates = [
      candidate("rust", ["rust"], 1000),
      candidate("react-low", ["react"], 100, 0.4),
      candidate("react-high", ["react", "frontend"], 185000, 0.95),
    ];
    const ranked = rankCandidates(needs, candidates);
    expect(ranked[0].candidate.name).toBe("react-high");
    expect(ranked.some((r) => r.candidate.name === "rust")).toBe(false);
  });
});

describe("rankByQuery", () => {
  it("matches free-text queries against tags", () => {
    const candidates = [
      candidate("playwright-e2e", ["testing", "e2e", "playwright"], 30000),
      candidate("docker", ["docker", "devops"], 28000),
    ];
    const ranked = rankByQuery("playwright e2e testing", candidates);
    expect(ranked[0].candidate.name).toBe("playwright-e2e");
  });
});
