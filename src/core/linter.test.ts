import { describe, expect, it } from "vitest";
import { lintManifest } from "./linter.js";
import type { SkillManifest } from "../types.js";

function manifest(over: Partial<SkillManifest>): SkillManifest {
  return {
    name: "demo-skill",
    description:
      "Helps you write great documentation. Use when the user asks to create or improve docs.",
    body: [
      "# demo-skill",
      "## When to use",
      "Use this when writing docs.",
      "## Instructions",
      "1. Do the thing.",
      "## Examples",
      "```\nexample here\n```",
      "more body text to clear the minimum length threshold ".repeat(5),
    ].join("\n"),
    ...over,
  };
}

describe("lintManifest", () => {
  it("grades a well-formed skill highly", () => {
    const r = lintManifest(manifest({}));
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.grade).toBe("A");
    expect(r.highQuality).toBe(true);
  });

  it("penalizes missing description", () => {
    const r = lintManifest(manifest({ description: "" }));
    expect(r.findings.some((f) => f.ruleId === "LQ010-desc-missing")).toBe(true);
    expect(r.score).toBeLessThan(90);
  });

  it("flags a description with no trigger phrase", () => {
    const r = lintManifest(
      manifest({ description: "A skill about documentation and writing things down nicely." })
    );
    expect(r.findings.some((f) => f.ruleId === "LQ013-desc-no-trigger")).toBe(true);
  });

  it("flags thin body", () => {
    const r = lintManifest(manifest({ body: "# x\nshort" }));
    expect(r.findings.some((f) => f.ruleId === "LQ021-body-thin")).toBe(true);
  });

  it("flags placeholder/TODO content", () => {
    const r = lintManifest(
      manifest({ body: manifest({}).body + "\nTODO: finish this section" })
    );
    expect(r.findings.some((f) => f.ruleId === "LQ030-placeholder")).toBe(true);
  });

  it("flags bad name format", () => {
    const r = lintManifest(manifest({ name: "Bad_Name" }));
    expect(r.findings.some((f) => f.ruleId === "LQ002-name-format")).toBe(true);
  });

  it("gives F to an empty skill", () => {
    const r = lintManifest({ name: "", description: "", body: "" });
    expect(r.grade).toBe("F");
    expect(r.highQuality).toBe(false);
  });

  it("flags broken internal links to missing bundled files", () => {
    const r = lintManifest(
      manifest({
        body:
          manifest({}).body +
          "\nSee [the reference](references/missing.md) for details.",
      }),
      { "SKILL.md": "x" } // no references/missing.md present
    );
    expect(r.findings.some((f) => f.ruleId === "LQ040-broken-internal-link")).toBe(true);
  });

  it("does not flag internal links that resolve to bundled files", () => {
    const r = lintManifest(
      manifest({
        body: manifest({}).body + "\nSee [ref](references/guide.md).",
      }),
      { "SKILL.md": "x", "references/guide.md": "content" }
    );
    expect(r.findings.some((f) => f.ruleId === "LQ040-broken-internal-link")).toBe(false);
  });

  it("rewards progressive disclosure for large skills with references", () => {
    const bigBody = "# big\n## When to use\n## Instructions\n## Examples\n" + "x".repeat(5000);
    const r = lintManifest(
      { name: "big-skill", description: "Use when you need a big skill. Helps a lot.", body: bigBody },
      { "SKILL.md": "x", "references/extra.md": "detail" }
    );
    expect(r.findings.some((f) => f.ruleId === "LQ041-progressive-disclosure")).toBe(true);
  });
});
