/**
 * Tiny zero-dependency logger with ANSI colors and level control.
 */

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

let quiet = false;
let useColor = process.stdout.isTTY ?? false;

export function setQuiet(v: boolean): void {
  quiet = v;
}

export function setColor(v: boolean): void {
  useColor = v;
}

function paint(color: keyof typeof COLORS, text: string): string {
  if (!useColor) return text;
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

export const c = {
  dim: (s: string) => paint("dim", s),
  red: (s: string) => paint("red", s),
  green: (s: string) => paint("green", s),
  yellow: (s: string) => paint("yellow", s),
  blue: (s: string) => paint("blue", s),
  magenta: (s: string) => paint("magenta", s),
  cyan: (s: string) => paint("cyan", s),
  bold: (s: string) => paint("bold", s),
};

export const log = {
  info(msg: string): void {
    if (!quiet) process.stdout.write(msg + "\n");
  },
  step(msg: string): void {
    if (!quiet) process.stdout.write(c.cyan("➜ ") + msg + "\n");
  },
  ok(msg: string): void {
    if (!quiet) process.stdout.write(c.green("✓ ") + msg + "\n");
  },
  warn(msg: string): void {
    if (!quiet) process.stderr.write(c.yellow("⚠ ") + msg + "\n");
  },
  error(msg: string): void {
    process.stderr.write(c.red("✗ ") + msg + "\n");
  },
  raw(msg: string): void {
    process.stdout.write(msg + "\n");
  },
};
