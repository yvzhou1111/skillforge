import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

/** Ask a yes/no question. Returns false when stdin is not a TTY (non-interactive). */
export async function confirm(question: string, defaultYes = false): Promise<boolean> {
  if (!stdin.isTTY) {
    return defaultYes;
  }
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const suffix = defaultYes ? " [Y/n] " : " [y/N] ";
    const answer = (await rl.question(question + suffix)).trim().toLowerCase();
    if (answer === "") return defaultYes;
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}
