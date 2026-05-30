import { describe, expect, it } from "vitest";
import { buildPlan, detectConflicts } from "./planner.js";
import type { CapabilityNeed, SkillCandidate, SkillRecommendation } from "../types.js";

function cand(name: string, tags: string[], sourceId = "catalog"): SkillCandidate {
  return {
    id: `${sourceId}:${name}`,
    name,
    description: `${name} for ${tags.join(", ")}`,
    sourceId,
    location: { kind: "github", ref: "x/y" },
    signals: { installs: 10000, reputation: 0.8 },
    tags,
  };
}

const need = (id: string): CapabilityNeed => ({
  id,
  label: id,
  source: "intent",
  confidence: 1,
  keywords: [id],
});

describe("buildPlan", () => {
  it("covers multiple needs with distinct skills", () => {
    const needs = [need("react"), need("testing"), need("docker")];
    const candidates = [
      cand("react-bp", ["react", "frontend"]),
      cand("tdd", ["testing", "tdd"]),
      cand("docker-skill", ["docker", "devops"]),
      cand("unrelated", ["rust"]),
    ];
    const plan = buildPlan(needs, candidates);
    const names = plan.recommendations.map((r) => r.candidate.name);
    expect(names).toContain("react-bp");
    expect(names).toContain("tdd");
    expect(names).toContain("docker-skill");
    expect(names).not.toContain("unrelated");
  });

  it("respects the limit", () => {
    const needs = [need("react"), need("testing"), need("docker"), need("seo")];
    const candidates = [
      cand("a", ["react"]),
      cand("b", ["testing"]),
      cand("c", ["docker"]),
      cand("d", ["seo"]),
    ];
    const plan = buildPlan(needs, candidates, { limit: 2 });
    expect(plan.recommendations.length).toBeLessThanOrEqual(2);
  });
});

describe("detectConflicts", () => {
  it("detects duplicate names from different sources", () => {
    const recs: SkillRecommendation[] = [
      { candidate: cand("dup", ["react"], "catalog"), score: 0.8, matchedNeeds: ["react"], reason: "" },
      { candidate: cand("dup", ["react"], "github"), score: 0.7, matchedNeeds: ["react"], reason: "" },
    ];
    const conflicts = detectConflicts(recs);
    expect(conflicts.some((c) => c.kind === "duplicate-name")).toBe(true);
  });

  it("detects overlapping capability when 3+ skills cover one need", () => {
    const recs: SkillRecommendation[] = ["a", "b", "c"].map((n) => ({
      candidate: cand(n, ["testing"]),
      score: 0.5,
      matchedNeeds: ["testing"],
      reason: "",
    }));
    const conflicts = detectConflicts(recs);
    expect(conflicts.some((c) => c.kind === "overlapping-capability")).toBe(true);
  });
});
