import { describe, expect, it } from "vitest";
import { getVersion } from "./version.js";

describe("getVersion", () => {
  it("returns a valid semver string from package.json", () => {
    const v = getVersion();
    expect(v).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("matches the package.json version", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.resolve(here, "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
    expect(getVersion()).toBe(pkg.version);
  });
});
