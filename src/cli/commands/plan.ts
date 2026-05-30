import path from "node:path";
import { buildPlan } from "../../core/planner.js";
import { buildRegistry } from "../../core/registry.js";
import { c, log } from "../../util/log.js";
import type { ParsedArgs } from "../args.js";
import { getBool, getNumber, getString } from "../args.js";
import { resolveNeeds } from "../needs.js";
import { renderNeeds, renderPlan } from "../render.js";

export async function cmdPlan(args: ParsedArgs): Promise<number> {
  const intent = args._.join(" ").trim() || getString(args, ["intent", "i"]);
  const root = path.resolve(getString(args, ["path", "p"]) ?? process.cwd());
  const offline = getBool(args, ["offline"]);
  const noScan = getBool(args, ["no-scan"]);
  const noLLM = getBool(args, ["no-llm"]);
  const asJson = getBool(args, ["json"]);
  const limit = getNumber(args, ["limit", "n"], 10);

  const needs = await resolveNeeds({
    projectRoot: root,
    intent,
    noScan,
    noLLM,
  });

  if (needs.length === 0) {
    log.warn("No capability needs detected. Provide an intent, e.g.:");
    log.raw('  skillforge plan "build a cross-border e-commerce site with payments"');
    return 1;
  }

  const registry = buildRegistry({
    offline,
    githubToken: process.env.GITHUB_TOKEN,
  });
  const { candidates, failures } = await registry.listAll({ offline });
  for (const f of failures) {
    log.warn(`Source "${f.sourceId}" failed: ${f.error}`);
  }
  if (offline) log.info(c.dim("Offline mode: using built-in catalog only."));

  const plan = buildPlan(needs, candidates, { limit });

  if (asJson) {
    log.raw(JSON.stringify(plan, null, 2));
    return 0;
  }

  renderNeeds(needs);
  renderPlan(plan);
  log.raw("");
  log.info(
    c.dim(
      "Install one: skillforge install <id> --agent claude-code   |   install all: skillforge auto"
    )
  );
  return 0;
}
