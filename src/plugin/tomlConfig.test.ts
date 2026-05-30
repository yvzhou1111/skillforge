import { describe, expect, it } from "vitest";
import { removeTomlMcpBlock, upsertTomlMcpBlock } from "./tomlConfig.js";

const entry = { command: "npx", args: ["-y", "skillforge-mcp"], env: {} };

const EXISTING = `# Codex CLI Configuration
model = "gpt-5.5"
approval_policy = "on-request"

[features]
skills = true

# MCP Tools
[mcp_servers.chrome]
command = "npx"
args = ["chrome-devtools-mcp@latest"]

[tui]
status_line = ["model-name"]
`;

describe("upsertTomlMcpBlock", () => {
  it("creates content from empty/null", () => {
    const { content, alreadyPresent } = upsertTomlMcpBlock(null, entry);
    expect(alreadyPresent).toBe(false);
    expect(content).toContain("[mcp_servers.skillforge]");
    expect(content).toContain('command = "npx"');
    expect(content).toContain('args = ["-y", "skillforge-mcp"]');
  });

  it("appends to an existing config, preserving comments and other tables", () => {
    const { content, alreadyPresent } = upsertTomlMcpBlock(EXISTING, entry);
    expect(alreadyPresent).toBe(false);
    // existing content preserved
    expect(content).toContain("# Codex CLI Configuration");
    expect(content).toContain('model = "gpt-5.5"');
    expect(content).toContain("[mcp_servers.chrome]");
    expect(content).toContain("[tui]");
    expect(content).toContain("# MCP Tools");
    // new block added
    expect(content).toContain("[mcp_servers.skillforge]");
  });

  it("replaces an existing skillforge block in place (idempotent)", () => {
    const first = upsertTomlMcpBlock(EXISTING, entry).content;
    const second = upsertTomlMcpBlock(first, {
      command: "npx",
      args: ["-y", "skillforge-mcp@latest"],
      env: {},
    });
    expect(second.alreadyPresent).toBe(true);
    // only one skillforge table
    const count = (second.content.match(/\[mcp_servers\.skillforge\]/g) ?? []).length;
    expect(count).toBe(1);
    // updated args present, old args gone
    expect(second.content).toContain("skillforge-mcp@latest");
    expect(second.content).not.toContain('"skillforge-mcp"]');
    // other tables still intact
    expect(second.content).toContain("[mcp_servers.chrome]");
    expect(second.content).toContain("[tui]");
  });

  it("includes env when non-empty", () => {
    const { content } = upsertTomlMcpBlock(null, {
      command: "npx",
      args: ["x"],
      env: { MUAPI_API_KEY: "abc" },
    });
    expect(content).toContain("env = { MUAPI_API_KEY = \"abc\" }");
  });
});

describe("removeTomlMcpBlock", () => {
  it("removes the skillforge block, keeping other tables", () => {
    const withSf = upsertTomlMcpBlock(EXISTING, entry).content;
    const removed = removeTomlMcpBlock(withSf);
    expect(removed).not.toBeNull();
    expect(removed).not.toContain("[mcp_servers.skillforge]");
    expect(removed).toContain("[mcp_servers.chrome]");
    expect(removed).toContain("[tui]");
    expect(removed).toContain('model = "gpt-5.5"');
  });

  it("returns null when no skillforge block exists", () => {
    expect(removeTomlMcpBlock(EXISTING)).toBeNull();
  });

  it("round-trips: add then remove restores equivalent config", () => {
    const withSf = upsertTomlMcpBlock(EXISTING, entry).content;
    const removed = removeTomlMcpBlock(withSf)!;
    // chrome + tui + features still there, skillforge gone
    expect(removed).toContain("[mcp_servers.chrome]");
    expect(removed).not.toContain("skillforge");
  });
});
