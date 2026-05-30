import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { getIntegration } from "./manifests.js";
import { mergeMcpConfig, removeMcpConfig } from "./mcpConfig.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sf-mcp-"));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

const entry = { command: "npx", args: ["-y", "skillforge-mcp"], env: {} };

describe("mergeMcpConfig (JSON / mcpServers)", () => {
  it("creates a new config with the skillforge entry", async () => {
    const cfg = path.join(tmp, ".mcp.json");
    const res = await mergeMcpConfig(getIntegration("claude-code"), cfg, entry);
    expect(res.created).toBe(true);
    const data = JSON.parse(await fs.readFile(cfg, "utf8"));
    expect(data.mcpServers.skillforge.command).toBe("npx");
  });

  it("preserves existing servers and backs up", async () => {
    const cfg = path.join(tmp, ".mcp.json");
    await fs.writeFile(
      cfg,
      JSON.stringify({ mcpServers: { other: { command: "x", args: [] } } }),
      "utf8"
    );
    const res = await mergeMcpConfig(getIntegration("claude-code"), cfg, entry);
    expect(res.created).toBe(false);
    expect(res.backupPath).toBeTruthy();
    const data = JSON.parse(await fs.readFile(cfg, "utf8"));
    expect(data.mcpServers.other).toBeTruthy();
    expect(data.mcpServers.skillforge).toBeTruthy();
  });

  it("removes the skillforge entry", async () => {
    const cfg = path.join(tmp, ".mcp.json");
    await mergeMcpConfig(getIntegration("claude-code"), cfg, entry);
    const removed = await removeMcpConfig(getIntegration("claude-code"), cfg);
    expect(removed).toBe(true);
    const data = JSON.parse(await fs.readFile(cfg, "utf8"));
    expect(data.mcpServers.skillforge).toBeUndefined();
  });
});

describe("mergeMcpConfig (YAML / Hermes)", () => {
  it("writes mcp_servers.skillforge in yaml", async () => {
    const cfg = path.join(tmp, "config.yaml");
    await mergeMcpConfig(getIntegration("hermes"), cfg, entry);
    const data = parseYaml(await fs.readFile(cfg, "utf8"));
    expect(data.mcp_servers.skillforge.command).toBe("npx");
  });

  it("preserves other yaml keys", async () => {
    const cfg = path.join(tmp, "config.yaml");
    await fs.writeFile(cfg, "model: gpt-test\nmcp_servers:\n  other:\n    command: y\n", "utf8");
    await mergeMcpConfig(getIntegration("hermes"), cfg, entry);
    const data = parseYaml(await fs.readFile(cfg, "utf8"));
    expect(data.model).toBe("gpt-test");
    expect(data.mcp_servers.other).toBeTruthy();
    expect(data.mcp_servers.skillforge).toBeTruthy();
  });
});

describe("mergeMcpConfig (TOML / Codex)", () => {
  it("writes a [mcp_servers.skillforge] table and preserves other content", async () => {
    const cfg = path.join(tmp, "config.toml");
    await fs.writeFile(
      cfg,
      '# header\nmodel = "gpt-5.5"\n\n[mcp_servers.chrome]\ncommand = "npx"\nargs = ["chrome-devtools-mcp@latest"]\n',
      "utf8"
    );
    const res = await mergeMcpConfig(getIntegration("codex"), cfg, entry);
    expect(res.created).toBe(false);
    expect(res.backupPath).toBeTruthy();
    const out = await fs.readFile(cfg, "utf8");
    expect(out).toContain("[mcp_servers.skillforge]");
    expect(out).toContain("[mcp_servers.chrome]");
    expect(out).toContain('model = "gpt-5.5"');
    expect(out).toContain("# header");
  });

  it("removes the skillforge TOML table", async () => {
    const cfg = path.join(tmp, "config.toml");
    await mergeMcpConfig(getIntegration("codex"), cfg, entry);
    const removed = await removeMcpConfig(getIntegration("codex"), cfg);
    expect(removed).toBe(true);
    const out = await fs.readFile(cfg, "utf8");
    expect(out).not.toContain("skillforge");
  });
});
