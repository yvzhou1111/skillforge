import type { CapabilityNeed, LLMConfig } from "../types.js";

/**
 * Optional LLM enhancement for intent analysis. When an API key is configured
 * (env SKILLFORGE_LLM_API_KEY / OPENAI_API_KEY), this refines the heuristic
 * capability needs by asking the model to expand/normalize them. When no key is
 * present, callers fall back to the offline heuristic and this module is a no-op.
 *
 * The integration targets an OpenAI-compatible /chat/completions endpoint, which
 * covers OpenAI, most local servers, and many proxies.
 */

export function resolveLLMConfig(): LLMConfig | null {
  const apiKey =
    process.env.SKILLFORGE_LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl:
      process.env.SKILLFORGE_LLM_BASE_URL ||
      "https://api.openai.com/v1",
    model: process.env.SKILLFORGE_LLM_MODEL || "gpt-4o-mini",
  };
}

interface LLMNeed {
  id: string;
  label: string;
  keywords?: string[];
}

/**
 * Ask the LLM to expand an intent into structured capability needs. Returns null
 * on any failure so the caller can fall back to heuristics gracefully.
 */
export async function enhanceNeedsWithLLM(
  intent: string,
  base: CapabilityNeed[],
  config: LLMConfig
): Promise<CapabilityNeed[] | null> {
  const system =
    "You expand a software project description into a list of technical capability tags " +
    "useful for finding relevant AI agent skills. Reply ONLY with compact JSON of the form " +
    '{"needs":[{"id":"react","label":"React","keywords":["frontend","jsx"]}]}. ' +
    "Use short lowercase kebab-case ids. Max 12 needs.";
  const user = `Project / intent: "${intent}".\nAlready detected ids: ${base
    .map((n) => n.id)
    .join(", ")}.\nReturn the merged, de-duplicated capability list.`;

  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as { needs?: LLMNeed[] };
    if (!parsed.needs || !Array.isArray(parsed.needs)) return null;

    const enhanced: CapabilityNeed[] = parsed.needs
      .filter((n) => n && typeof n.id === "string")
      .map((n) => ({
        id: n.id.toLowerCase().trim(),
        label: n.label || n.id,
        source: "intent" as const,
        confidence: 0.75,
        keywords: Array.from(
          new Set([n.id.toLowerCase(), ...(n.keywords ?? []).map((k) => k.toLowerCase())])
        ),
      }));

    return enhanced.length > 0 ? enhanced : null;
  } catch {
    return null;
  }
}
