import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installPlugin, pluginStatus, uninstallPlugin } from "./installer.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sf-plugin-"));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("installPlugin", () => {
  it("copies the skill and registers MCP for claude-code (project scope)", async () => {
    const report = await installPlugin({
      agent: "claude-code",
      global: false,
      projectRoot: tmp,
    });

    expect(report.skillCopied).toBe(true);
    // SKILL.md should exist in the target skill dir
    const skillMd = path.join(report.skillDir, "SKILL.md");
    expect(await fileExists(skillMd)).toBe(true);

    // MCP config should be written at <project>/.mcp.json
    expect(report.mcp?.configPath).toBe(path.join(tmp, ".mcp.json"));
    const cfg = JSON.parse(await fs.readFile(report.mcp!.configPath, "utf8"));
    expect(cfg.mcpServers.skillforge.command).toBe("npx");
  });

  it("dry-run writes nothing", async () => {
    const report = await installPlugin({
      agent: "cursor",
      global: false,
      projectRoot: tmp,
      dryRun: true,
    });
    expect(report.dryRun).toBe(true);
    expect(report.skillCopied).toBe(false);
    // No skill dir created
    expect(await fileExists(report.skillDir)).toBe(false);
  });

  it("status reflects installed then uninstalled", async () => {
    await installPlugin({ agent: "generic", global: false, projectRoot: tmp });
    let status = await pluginStatus(tmp, false, ["generic"]);
    expect(status[0].skillInstalled).toBe(true);

    const un = await uninstallPlugin({ agent: "generic", global: false, projectRoot: tmp });
    expect(un.skillRemoved).toBe(true);

    status = await pluginStatus(tmp, false, ["generic"]);
    expect(status[0].skillInstalled).toBe(false);
  });
});

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
