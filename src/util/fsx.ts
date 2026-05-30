import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

/** Compute a sha256 hex digest of a string. */
export function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function readTextIfExists(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/** Recursively copy a directory of text/binary files. */
export async function copyDir(src: string, dest: string): Promise<void> {
  await ensureDir(dest);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else if (entry.isFile()) {
      await fs.copyFile(s, d);
    }
  }
}

/** Read every text file in a directory tree into a relative-path map. */
export async function readDirTree(
  root: string,
  opts: { maxFileBytes?: number } = {}
): Promise<Record<string, string>> {
  const maxBytes = opts.maxFileBytes ?? 512 * 1024;
  const out: Record<string, string> = {};

  async function walk(dir: string, rel: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        await walk(abs, relPath);
      } else if (entry.isFile()) {
        const stat = await fs.stat(abs);
        if (stat.size > maxBytes) continue;
        try {
          out[relPath] = await fs.readFile(abs, "utf8");
        } catch {
          // skip unreadable / binary
        }
      }
    }
  }

  await walk(root, "");
  return out;
}

export function homeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || ".";
}
