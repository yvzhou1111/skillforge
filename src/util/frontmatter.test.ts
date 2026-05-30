import { describe, expect, it } from "vitest";
import {
  parseFrontmatter,
  parseSkillManifest,
  stringifySkill,
} from "./frontmatter.js";

describe("parseFrontmatter", () => {
  it("splits frontmatter and body", () => {
    const doc = `---\nname: test\ndescription: hello\n---\n# Body\ncontent`;
    const { data, body } = parseFrontmatter(doc);
    expect(data.name).toBe("test");
    expect(data.description).toBe("hello");
    expect(body).toContain("# Body");
  });

  it("handles missing frontmatter", () => {
    const { data, body } = parseFrontmatter("# Just markdown");
    expect(data).toEqual({});
    expect(body).toBe("# Just markdown");
  });

  it("tolerates malformed yaml", () => {
    const doc = `---\nname: : : bad\n---\nbody`;
    const { body } = parseFrontmatter(doc);
    expect(body).toBe("body");
  });

  it("strips BOM", () => {
    const doc = `\uFEFF---\nname: x\n---\nbody`;
    const { data } = parseFrontmatter(doc);
    expect(data.name).toBe("x");
  });
});

describe("parseSkillManifest", () => {
  it("parses name, description and allowed-tools", () => {
    const doc = `---\nname: my-skill\ndescription: does things\nallowed-tools: [read, write]\n---\n# body`;
    const m = parseSkillManifest(doc);
    expect(m.name).toBe("my-skill");
    expect(m.description).toBe("does things");
    expect(m.allowedTools).toEqual(["read", "write"]);
  });

  it("uses fallback name when missing", () => {
    const doc = `---\ndescription: no name\n---\nbody`;
    const m = parseSkillManifest(doc, "fallback");
    expect(m.name).toBe("fallback");
  });

  it("throws when no name and no fallback", () => {
    expect(() => parseSkillManifest("---\ndescription: x\n---\nbody")).toThrow();
  });
});

describe("stringifySkill round-trip", () => {
  it("produces parseable output", () => {
    const md = stringifySkill({
      name: "demo",
      description: "a demo skill",
      body: "# demo\ncontent",
    });
    const m = parseSkillManifest(md);
    expect(m.name).toBe("demo");
    expect(m.description).toBe("a demo skill");
  });
});
