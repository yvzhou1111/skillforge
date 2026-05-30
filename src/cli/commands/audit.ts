import path from "node:path";
import { auditSkill } from "../../core/auditor.js";
import { buildRegistry, materializeCandidate } from "../../core/registry.js";
import { parseSkillManifest } from "../../util/frontmatter.js";
import { readDirTree, readTextIfExists } from "../../util/fsx.js";
import { log } from "../../util/log.js";
import type { MaterializedSkill } from "../../types.js";
import type { ParsedArgs } from "../args.js";
import { getBool, getString } from "../args.js";
import { renderAudit } from "../render.js";
import { resolveCandidate } from "../resolve.js";

export async function cmdAudit(args: ParsedArgs): Promise<number> {
  const ref = args._[0];
  const localPath = getString(args, ["dir", "d"]);
  const offline = getBool(args, ["offline"]);
  const asJson = getBool(args, ["json"]);

  if (!ref && !localPath) {
    log.error('Usage: skillforge audit <skill-id|owner/repo>   OR   skillforge audit --dir ./path');
    return 1;
  }

  let materialized: MaterializedSkill;

  if (localPath) {
    const dir = path.resolve(localPath);
    const skillMd = await readTextIfExists(path.join(dir, "SKILL.md"));
    if (!skillMd) {
      log.error(`No SKILL.md found in ${dir}`);
      return 1;
    }
    const files = await readDirTree(dir);
    materialized = {
      manifest: parseSkillManifest(skillMd, path.basename(dir)),
      files,
      candidate: {
        id: `local:${dir}`,
        name: path.basename(dir),
        description: "Local skill",
        sourceId: "local",
        location: { kind: "local", ref: dir },
        signals: {},
        tags: [],
      },
    };
  } else {
    const registry = buildRegistry({ offline, githubToken: process.env.GITHUB_TOKEN });
    const candidate = await resolveCandidate(registry, ref, { offline });
    if (!candidate) {
      log.error(`Could not resolve skill: ${ref}`);
      return 1;
    }
    try {
      materialized = await materializeCandidate(registry, candidate, { offline });
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err));
      return 1;
    }
  }

  const report = auditSkill(materialized);

  if (asJson) {
    log.raw(JSON.stringify(report, null, 2));
    return report.blocked ? 2 : 0;
  }

  renderAudit(report);
  return report.blocked ? 2 : 0;
}
