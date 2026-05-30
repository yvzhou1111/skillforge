import { describe, expect, it } from "vitest";
import { analyzeIntent, mergeNeeds } from "./intent.js";

describe("analyzeIntent", () => {
  it("extracts payments, i18n, and ecommerce from a cross-border shop goal", () => {
    const needs = analyzeIntent("build a cross-border e-commerce site with payments");
    const ids = needs.map((n) => n.id);
    expect(ids).toContain("payments");
    expect(ids).toContain("ecommerce");
    expect(ids).toContain("i18n");
  });

  it("works with Chinese input", () => {
    const needs = analyzeIntent("做一个带支付的跨境电商，需要多语言和测试");
    const ids = needs.map((n) => n.id);
    expect(ids).toContain("payments");
    expect(ids).toContain("i18n");
    expect(ids).toContain("testing");
  });

  it("extracts testing and ci from a devops goal", () => {
    const needs = analyzeIntent("add end-to-end tests and a CI/CD pipeline with docker");
    const ids = needs.map((n) => n.id);
    expect(ids).toContain("testing");
    expect(ids).toContain("e2e");
    expect(ids).toContain("ci-cd");
    expect(ids).toContain("docker");
  });

  it("returns empty for unrelated text", () => {
    const needs = analyzeIntent("the quick brown fox");
    expect(needs).toHaveLength(0);
  });

  it("matches plural trigger words (tests, payments, apis)", () => {
    expect(analyzeIntent("add tests").map((n) => n.id)).toContain("testing");
    expect(analyzeIntent("design some APIs").map((n) => n.id)).toContain("api");
  });

  it("does not over-match longer words (testing should not trigger via 'test'+s rule incorrectly)", () => {
    // 'design' must not be triggered by spurious substrings
    const ids = analyzeIntent("quicksand").map((n) => n.id);
    expect(ids).toHaveLength(0);
  });
});

describe("mergeNeeds", () => {
  it("dedupes and keeps highest confidence", () => {
    const a = analyzeIntent("react frontend");
    const b = [
      {
        id: "react",
        label: "React",
        source: "dependency" as const,
        confidence: 0.95,
        keywords: ["react"],
      },
    ];
    const merged = mergeNeeds(a, b);
    const react = merged.find((n) => n.id === "react");
    expect(react?.confidence).toBeCloseTo(0.95);
    // only one react entry
    expect(merged.filter((n) => n.id === "react")).toHaveLength(1);
  });
});
