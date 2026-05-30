import path from "node:path";
import { readLockfile } from "../../core/lockfile.js";
import { c, log } from "../../util/log.js";
import type { ParsedArgs } from "../args.js";
import { getBool, getString } from "../args.js";

export async function cmdList(args: ParsedArgs): Promise<number> {
  const root = path.resolve(getString(args, ["path", "p"]) ?? process.cwd());
  const asJson = getBool(args, ["json"]);

  const lock = await readLockfile(root);

  if (asJson) {
    log.raw(JSON.stringify(lock, null, 2));
    return 0;
  }

  if (lock.skills.length === 0) {
    log.info("No skills installed (no skillforge.lock.json entries).");
    return 0;
  }

  log.raw(c.bold(`\nInstalled skills (${lock.skills.length}):`));
  for (const s of lock.skills) {
    const loc =
      s.location.kind === "github"
        ? `${s.location.ref}${s.location.subPath ? "/" + s.location.subPath : ""}`
        : s.location.ref;
    log.raw(
      `  ${c.green(s.name.padEnd(28))} ${c.dim(`${s.agent}/${s.scope}`)}  ${c.dim(loc)}`
    );
  }
  return 0;
}
