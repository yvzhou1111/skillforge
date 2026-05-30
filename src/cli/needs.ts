import type { CapabilityNeed } from "../types.js";
import { analyzeIntent, mergeNeeds } from "../core/intent.js";
import { scanProject } from "../core/scanner.js";
import { enhanceNeedsWithLLM, resolveLLMConfig } from "../core/llm.js";
import { c, log } from "../util/log.js";

export interface ResolveNeedsOptions {
  projectRoot: string;
  intent?: string;
  /** Skip project scanning (intent only). */
  noScan?: boolean;
  /** Disable LLM enhancement even if a key is present. */
  noLLM?: boolean;
}

/**
 * Resolve capability needs from project scan + intent text, optionally refined
 * by an LLM. Always returns something usable offline.
 */
export async function resolveNeeds(
  opts: ResolveNeedsOptions
): Promise<CapabilityNeed[]> {
  const groups: CapabilityNeed[][] = [];

  if (!opts.noScan) {
    const scan = await scanProject(opts.projectRoot);
    if (scan.needs.length > 0) {
      log.info(c.dim(`Scan found ${scan.needs.length} capability need(s).`));
    }
    groups.push(scan.needs);
  }

  if (opts.intent) {
    const intentNeeds = analyzeIntent(opts.intent);
    groups.push(intentNeeds);
  }

  let merged = mergeNeeds(...groups);

  // Optional LLM refinement.
  if (!opts.noLLM && opts.intent) {
    const config = resolveLLMConfig();
    if (config) {
      log.info(c.dim(`Refining needs with LLM (${config.model})...`));
      const enhanced = await enhanceNeedsWithLLM(opts.intent, merged, config);
      if (enhanced) {
        merged = mergeNeeds(merged, enhanced);
      } else {
        log.warn("LLM refinement failed; using heuristic needs.");
      }
    }
  }

  return merged;
}
