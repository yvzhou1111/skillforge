import path from "node:path";
import { describe, expect, it } from "vitest";
import { getAdapter, isAgentId, listAgents } from "./adapter.js";

describe("adapters", () => {
  it("lists all known agents", () => {
    expect(listAgents()).toEqual(
      expect.arrayContaining(["claude-code", "cursor", "codex", "gemini", "generic"])
    );
  });

  it("resolves claude-code project skill dir", () => {
    const dir = getAdapter("claude-code").resolveSkillDir({
      skillName: "my-skill",
      scope: "project",
      projectRoot: "/proj",
    });
    expect(dir).toBe(path.join("/proj", ".claude", "skills", "my-skill"));
  });

  it("resolves cursor global skill dir under home", () => {
    const dir = getAdapter("cursor").resolveSkillDir({
      skillName: "s",
      scope: "global",
      projectRoot: "/proj",
    });
    expect(dir).toContain(path.join(".cursor", "skills", "s"));
  });

  it("validates agent ids", () => {
    expect(isAgentId("claude-code")).toBe(true);
    expect(isAgentId("nope")).toBe(false);
  });
});
