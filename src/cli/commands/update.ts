import path from "node:path";
import { readLockfile } from "../../core/lockfile.js";
import { buildRegistry, materializeCandidate } from "../../core/registry.js";
import { sha256 } from "../../util/fsx.js";
import { c, log } from "../../util/log.js";
import type { SkillCandidate } from "../../types.js";
import type { ParsedArgs } from "../args.js";
import { getBool, getString } from "../args.js";

export async function cmdUpdate(args: ParsedArgs): Promise<number> {
  const root = path.resolve(getString(args, ["path", "p"]) ?? process.cwd());
  const offline = getBool(args, ["offline"]);

  const lock = await readLockfile(root);
  if (lock.skills.length === 0) {
    log.info("No installed skills to check.");
    return 0;
  }
  if (offline) {
    log.warn("Update check requires network access; offline mode can't compare upstream.");
    return 1;
  }

  const registry = buildRegistry({ githubToken: process.env.GITHUB_TOKEN });
  log.step(`Checking ${lock.skills.length} skill(s) for updates...`);

  let outdated = 0;
  for (const s of lock.skills) {
    const candidate: SkillCandidate = {
      id: `${s.sourceId}:${s.name}`,
      name: s.name,
      description: "",
      sourceId: s.sourceId,
      location: s.location,
      signals: {},
      tags: [],
    };
    try {
      const materialized = await materializeCandidate(registry, candidate);
      const upstream = sha256(materialized.files["SKILL.md"] ?? "");
      if (upstream !== s.checksum) {
        outdated++;
        log.raw(`  ${c.yellow("⟳")} ${c.green(s.name)} ${c.dim("has upstream changes")}`);
      } else {
        log.raw(`  ${c.green("✓")} ${s.name} ${c.dim("up to date")}`);
      }
    } catch (err) {
      log.warn(`  Could not check ${s.name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  log.raw("");
  if (outdated === 0) {
    log.ok("All skills up to date.");
  } else {
    log.info(
      `${outdated} skill(s) have upstream changes. Re-install with --overwrite to update.`
    );
  }
  return 0;
}
