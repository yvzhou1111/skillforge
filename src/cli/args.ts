/**
 * Minimal zero-dependency argument parser.
 * Supports: positional args, --flag, --key value, --key=value, -short.
 *
 * Boolean flags (declared in BOOLEAN_FLAGS) never consume the following token,
 * so `--offline scan` is parsed as flag `offline` + command `scan`, not as
 * `offline="scan"`. This makes flags position-independent.
 */
export interface ParsedArgs {
  _: string[];
  flags: Record<string, string | boolean>;
}

/** Flags that are always boolean and must not consume the next token. */
export const BOOLEAN_FLAGS = new Set<string>([
  "no-color",
  "quiet",
  "json",
  "offline",
  "no-llm",
  "no-scan",
  "dry-run",
  "yes",
  "y",
  "force",
  "f",
  "global",
  "g",
  "overwrite",
  "skip-audit",
  "help",
  "h",
  "version",
  "v",
]);

export function parseArgs(argv: string[]): ParsedArgs {
  const _: string[] = [];
  const flags: Record<string, string | boolean> = {};

  const consumesValue = (key: string, next: string | undefined): boolean => {
    if (BOOLEAN_FLAGS.has(key)) return false;
    if (next === undefined) return false;
    if (next.startsWith("-") && next.length > 1) return false;
    return true;
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      if (eq !== -1) {
        const key = token.slice(2, eq);
        flags[key] = token.slice(eq + 1);
      } else {
        const key = token.slice(2);
        const next = argv[i + 1];
        if (consumesValue(key, next)) {
          flags[key] = next as string;
          i++;
        } else {
          flags[key] = true;
        }
      }
    } else if (token.startsWith("-") && token.length > 1) {
      const key = token.slice(1);
      const next = argv[i + 1];
      if (consumesValue(key, next)) {
        flags[key] = next as string;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      _.push(token);
    }
  }

  return { _, flags };
}

export function getString(
  args: ParsedArgs,
  keys: string[],
  fallback?: string
): string | undefined {
  for (const key of keys) {
    const v = args.flags[key];
    if (typeof v === "string") return v;
  }
  return fallback;
}

export function getBool(args: ParsedArgs, keys: string[]): boolean {
  for (const key of keys) {
    const v = args.flags[key];
    if (v === true || v === "true") return true;
  }
  return false;
}

export function getNumber(
  args: ParsedArgs,
  keys: string[],
  fallback?: number
): number | undefined {
  for (const key of keys) {
    const v = args.flags[key];
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
      return Number(v);
    }
  }
  return fallback;
}
