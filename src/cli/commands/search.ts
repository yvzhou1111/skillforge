import { buildRegistry } from "../../core/registry.js";
import { rankByQuery } from "../../core/scorer.js";
import { c, log } from "../../util/log.js";
import type { ParsedArgs } from "../args.js";
import { getBool, getNumber } from "../args.js";

export async function cmdSearch(args: ParsedArgs): Promise<number> {
  const query = args._.join(" ").trim();
  if (!query) {
    log.error('Usage: skillforge search "<query>"');
    return 1;
  }
  const offline = getBool(args, ["offline"]);
  const asJson = getBool(args, ["json"]);
  const limit = getNumber(args, ["limit", "n"], 15) ?? 15;

  const registry = buildRegistry({
    offline,
    githubToken: process.env.GITHUB_TOKEN,
  });
  const { candidates, failures } = await registry.listAll({ offline });
  for (const f of failures) log.warn(`Source "${f.sourceId}" failed: ${f.error}`);
  if (offline) log.info(c.dim("Offline mode: built-in catalog only."));

  const ranked = rankByQuery(query, candidates).slice(0, limit);

  if (asJson) {
    log.raw(
      JSON.stringify(
        ranked.map((r) => ({
          id: r.candidate.id,
          name: r.candidate.name,
          score: Math.round(r.score * 100) / 100,
          description: r.candidate.description,
        })),
        null,
        2
      )
    );
    return 0;
  }

  if (ranked.length === 0) {
    log.warn(`No skills matched "${query}".`);
    return 0;
  }

  log.raw(c.bold(`\nResults for "${query}":`));
  let i = 1;
  for (const r of ranked) {
    const installs = r.candidate.signals.installs;
    const meta = [
      `[${r.candidate.sourceId}]`,
      `score ${Math.round(r.score * 100)}%`,
      installs ? `${formatInstalls(installs)} installs` : null,
    ]
      .filter(Boolean)
      .join(" ");
    log.raw(`  ${c.bold(String(i).padStart(2))}. ${c.green(r.candidate.name)} ${c.dim(meta)}`);
    log.raw(`      ${r.candidate.description}`);
    log.raw(`      ${c.dim("id: " + r.candidate.id)}`);
    i++;
  }
  return 0;
}

function formatInstalls(n: number): string {
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}
