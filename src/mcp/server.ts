/**
 * Minimal, zero-dependency MCP (Model Context Protocol) server over stdio.
 *
 * Implements the JSON-RPC 2.0 message framing MCP uses on stdin/stdout:
 *   - initialize
 *   - tools/list
 *   - tools/call
 *   - ping
 *
 * Messages are newline-delimited JSON (one JSON object per line), which is the
 * common stdio transport used by Claude Code, Hermes, OpenClaw, Cursor, etc.
 *
 * This deliberately avoids the official SDK to keep SkillForge dependency-light
 * and portable across every agent that speaks MCP over stdio.
 */
import { createInterface } from "node:readline";
import { TOOLS, findTool } from "./tools.js";
import { getVersion } from "../util/version.js";

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "skillforge", version: getVersion() };

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

function send(msg: JsonRpcResponse): void {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function ok(id: JsonRpcRequest["id"], result: unknown): void {
  send({ jsonrpc: "2.0", id: id ?? null, result });
}

function fail(id: JsonRpcRequest["id"], code: number, message: string, data?: unknown): void {
  send({ jsonrpc: "2.0", id: id ?? null, error: { code, message, data } });
}

/** Log to stderr so it never corrupts the stdout JSON-RPC stream. */
function logErr(msg: string): void {
  process.stderr.write(`[skillforge-mcp] ${msg}\n`);
}

async function handleRequest(req: JsonRpcRequest): Promise<void> {
  switch (req.method) {
    case "initialize": {
      ok(req.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "SkillForge discovers, security-audits, and installs Agent Skills. " +
          "Use skillforge_scan/plan to decide what to install, skillforge_audit before trusting a skill, " +
          "and skillforge_install to write it into the target agent. Never bypass audits for untrusted skills.",
      });
      return;
    }

    case "notifications/initialized":
      // Notification: no response expected.
      return;

    case "ping":
      ok(req.id, {});
      return;

    case "tools/list": {
      ok(req.id, {
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });
      return;
    }

    case "tools/call": {
      const params = req.params ?? {};
      const name = String(params.name ?? "");
      const args = (params.arguments as Record<string, unknown>) ?? {};
      const tool = findTool(name);
      if (!tool) {
        fail(req.id, -32602, `Unknown tool: ${name}`);
        return;
      }
      try {
        const result = await tool.handler(args);
        ok(req.id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
          isError: false,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logErr(`tool ${name} failed: ${message}`);
        // Per MCP, tool execution errors are reported in the result with isError.
        ok(req.id, {
          content: [{ type: "text", text: `Error: ${message}` }],
          isError: true,
        });
      }
      return;
    }

    default:
      // Unknown method. Only respond to requests (those with an id).
      if (req.id !== undefined) {
        fail(req.id, -32601, `Method not found: ${req.method}`);
      }
      return;
  }
}

export function startMcpServer(): void {
  logErr(`starting (protocol ${PROTOCOL_VERSION}, ${TOOLS.length} tools)`);
  const rl = createInterface({ input: process.stdin });

  let pending = 0;
  let inputClosed = false;
  const maybeExit = () => {
    if (inputClosed && pending === 0) {
      logErr("stdin closed and all work drained, exiting");
      process.exit(0);
    }
  };

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let req: JsonRpcRequest;
    try {
      req = JSON.parse(trimmed) as JsonRpcRequest;
    } catch {
      logErr(`failed to parse line: ${trimmed.slice(0, 120)}`);
      return;
    }
    pending++;
    handleRequest(req)
      .catch((err) => {
        logErr(`unhandled: ${err instanceof Error ? err.message : String(err)}`);
        if (req.id !== undefined) fail(req.id, -32603, "Internal error");
      })
      .finally(() => {
        pending--;
        maybeExit();
      });
  });

  rl.on("close", () => {
    inputClosed = true;
    maybeExit();
  });
}
