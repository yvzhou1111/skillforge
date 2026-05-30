#!/usr/bin/env node
/**
 * Entry point for the SkillForge MCP server (`skillforge-mcp`).
 * Speaks MCP over stdio so any MCP-capable agent (Claude Code, Hermes,
 * OpenClaw, Cursor, Codex, Gemini CLI, ...) can call SkillForge's tools.
 */
import { startMcpServer } from "./mcp/server.js";

startMcpServer();
