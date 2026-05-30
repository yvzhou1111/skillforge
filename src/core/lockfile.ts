import { promises as fs } from "node:fs";
import path from "node:path";
import type { InstalledSkill, Lockfile } from "../types.js";
import { readTextIfExists } from "../util/fsx.js";

export const LOCKFILE_NAME = "skillforge.lock.json";

export function lockfilePath(projectRoot: string): string {
  return path.join(projectRoot, LOCKFILE_NAME);
}

export async function readLockfile(projectRoot: string): Promise<Lockfile> {
  const raw = await readTextIfExists(lockfilePath(projectRoot));
  if (!raw) return { version: 1, skills: [] };
  try {
    const parsed = JSON.parse(raw) as Lockfile;
    if (parsed.version !== 1 || !Array.isArray(parsed.skills)) {
      return { version: 1, skills: [] };
    }
    return parsed;
  } catch {
    return { version: 1, skills: [] };
  }
}

export async function writeLockfile(
  projectRoot: string,
  lock: Lockfile
): Promise<void> {
  const sorted = {
    ...lock,
    skills: [...lock.skills].sort((a, b) =>
      `${a.agent}/${a.name}`.localeCompare(`${b.agent}/${b.name}`)
    ),
  };
  await fs.writeFile(
    lockfilePath(projectRoot),
    JSON.stringify(sorted, null, 2) + "\n",
    "utf8"
  );
}

/** Insert or replace an installed skill entry (keyed by name+agent+scope). */
export function upsertSkill(lock: Lockfile, skill: InstalledSkill): Lockfile {
  const skills = lock.skills.filter(
    (s) =>
      !(s.name === skill.name && s.agent === skill.agent && s.scope === skill.scope)
  );
  skills.push(skill);
  return { ...lock, skills };
}

export function findSkill(
  lock: Lockfile,
  name: string,
  agent: string,
  scope: string
): InstalledSkill | undefined {
  return lock.skills.find(
    (s) => s.name === name && s.agent === agent && s.scope === scope
  );
}
