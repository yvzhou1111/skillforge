import path from "node:path";
import { scanProject } from "../../core/scanner.js";
import { c, log } from "../../util/log.js";
import type { ParsedArgs } from "../args.js";
import { getBool, getString } from "../args.js";
import { renderNeeds } from "../render.js";

export async function cmdScan(args: ParsedArgs): Promise<number> {
  const root = path.resolve(getString(args, ["path", "p"], args._[0]) ?? process.cwd());
  const asJson = getBool(args, ["json"]);

  log.step(`Scanning project at ${c.dim(root)}`);
  const result = await scanProject(root);

  if (asJson) {
    log.raw(JSON.stringify(result, null, 2));
    return 0;
  }

  if (result.detectedFiles.length > 0) {
    log.raw(c.dim(`Detected: ${result.detectedFiles.join(", ")}`));
  }
  if (result.lowConfidence) {
    log.warn("No dependency manifests found; results are heuristic (low confidence).");
  }
  renderNeeds(result.needs);
  log.raw("");
  log.info(c.dim('Next: skillforge plan   (or)   skillforge auto "<your goal>"'));
  return 0;
}
