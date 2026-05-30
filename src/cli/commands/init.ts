import { promises as fs } from "node:fs";
import path from "node:path";
import { stringifySkill } from "../../util/frontmatter.js";
import { ensureDir, pathExists } from "../../util/fsx.js";
import { c, log } from "../../util/log.js";
import type { ParsedArgs } from "../args.js";
import { getString } from "../args.js";

export async function cmdInit(args: ParsedArgs): Promise<number> {
  const name = (args._[0] ?? getString(args, ["name"]))?.trim();
  if (!name) {
    log.error("Usage: skillforge init <skill-name>");
    return 1;
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    log.error("Skill name must be lowercase kebab-case (e.g. my-skill).");
    return 1;
  }

  const dir = path.resolve(getString(args, ["dir", "d"]) ?? name);
  if (await pathExists(dir)) {
    log.error(`Directory already exists: ${dir}`);
    return 1;
  }

  await ensureDir(dir);
  const skillMd = stringifySkill({
    name,
    description: `TODO: one-sentence description of when to use ${name}. This is what the agent reads to decide whether to load the skill.`,
    body: [
      `# ${name}`,
      "",
      "## When to use",
      "",
      "Describe the situations where this skill applies.",
      "",
      "## Instructions",
      "",
      "1. Step one.",
      "2. Step two.",
      "",
      "## Examples",
      "",
      "Provide concrete examples.",
      "",
    ].join("\n"),
  });

  await fs.writeFile(path.join(dir, "SKILL.md"), skillMd, "utf8");
  log.ok(`Created skill scaffold at ${c.dim(dir)}`);
  log.info("Edit SKILL.md, then audit it: " + c.cyan(`skillforge audit --dir ${dir}`));
  return 0;
}
