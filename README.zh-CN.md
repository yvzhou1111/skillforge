<div align="center">

<img src="docs/images/logo.png" alt="SkillForge logo" width="140" />

# SkillForge

[English](./README.md) · **简体中文** · [日本語](./README.ja.md)

**面向 Agent Skills 的智能依赖管家** —— 读懂你的项目与意图，从开源 skill 生态挖掘候选，
**逐个做安全审查与质量评分**，再把一套甄选过的组合安装进你指定的 agent：
Claude Code、Cursor、Codex、Gemini、Hermes、OpenClaw。

<img src="docs/images/architecture.png" alt="SkillForge 架构图" width="860" />

</div>

SkillForge 不是「又一个 skill 目录」，而是一个**编排器（orchestrator）**，
把一个目标变成「已安装、已审查」的能力：

```
扫描(技术栈) + 意图(自然语言)
        │
        ▼
   规划  ──►  审查  ──►  安装  ──►  lockfile
 (排序+理由) (安全门控) (按 agent 适配) (可审计记录)
```

## 为什么需要它

2025–2026 年，基于 `SKILL.md` 标准的 Agent Skills 生态爆发式增长：
`anthropics/skills`、`vercel-labs/skills`(skills.sh)、`VoltAgent/awesome-agent-skills`(700+)
等仓库里有数以万计的 skill。但现有工具有四个共性缺口，SkillForge 正是来补这些：

1. **发现只停留在关键词检索**。SkillForge 从你的*项目*和*自然语言目标*推断需求，再规划组合，而不只是一个搜索框。
2. **没人做审查**。skill 可以携带可执行脚本和工具调用 hook。SkillForge 在落盘前做**静态安全审查**，默认拦截高危/严重风险。
3. **多 agent 安装很乱**。一次发现 → 通过可插拔适配器安装进任意 agent。
4. **缺少生命周期管理**。SkillForge 写入 `skillforge.lock.json` 以便审计与更新检查。

## 安装

发布到 npm 后，可零安装直接用：

```bash
npx skillforge-butler <命令>          # CLI（包名为 skillforge-butler）
npx -p skillforge-butler skillforge-mcp   # MCP 服务（供 agent 调用）
```

或全局安装（提供 `skillforge`、`sf`、`skillforge-mcp` 命令）：

```bash
npm install -g skillforge-butler
skillforge --help             # 或别名 `sf`
```

从源码（开发）：

```bash
npm install        # 安装依赖
npm run build      # 编译到 dist/
npm link           # 暴露 `skillforge` / `sf` 到全局
node dist/cli.js <命令>
```

## 快速上手

```bash
# 1. 看看项目需要什么
sf scan

# 2. 针对一个目标给出推荐（不安装）
sf plan "做一个带支付和多语言的跨境电商" --dry-run

# 3. 一条龙：扫描 → 规划 → 审查 → 安装到 Claude Code
sf auto "做一个带支付和多语言的跨境电商" --agent claude-code

# 4. 信任第三方 skill 前先审查
sf audit some-owner/some-repo/skills/their-skill

# 5. 搜索生态
sf search "playwright 端到端测试"
```

## 命令

| 命令 | 作用 |
|---|---|
| `sf scan` | 检测技术栈 → 能力需求 |
| `sf search "<查询>"` | 按相关度+质量（安装量/star/来源信誉）排序检索 |
| `sf plan ["<意图>"]` | 推荐 skill 组合，附理由 + 冲突检测 |
| `sf audit <id\|--dir 路径>` | 对 skill 做静态安全审查 |
| `sf lint <id\|--dir 路径>` | 对 skill 评质量等级（A–F） |
| `sf install <id> --agent <a>` | 审查 + 安装单个 skill |
| `sf auto ["<意图>"]` | 全流程：扫描 → 规划 → 审查 → 安装 |
| `sf list` | 显示 lockfile 中已安装的 skill |
| `sf update` | 检查已装 skill 的上游变更 |
| `sf init <名称>` | 脚手架生成新的 `SKILL.md` |
| `sf plugin <install\|...>` | 把 SkillForge 自身装进某个 agent（skill + MCP） |
| `sf mcp` | 运行 SkillForge MCP 服务（stdio） |

运行 `sf help` 查看全部选项。

## 安全审查

这是 SkillForge 的核心差异点。静态审查器（`src/core/auditor.ts`）会标记包括但不限于：

| 规则 | 风险 | 捕获内容 |
|---|---|---|
| `curl \| sh` | 严重 | 远程代码执行一行命令 |
| base64 → shell | 严重 | 混淆载荷 |
| `rm -rf` | 高 | 破坏性删除 |
| `sudo` | 高 | 提权 |
| 敏感文件 | 高 | `.env`、`id_rsa`、`~/.ssh`、凭证 |
| 外联请求 | 高 | 可能的数据外泄 |
| 工具调用 hook | 高 | `PreToolUse`/`PostToolUse` 注册 |
| home 目录写入 | 中 | 篡改全局配置 |
| `chmod 777` | 中 | 权限弱化 |
| 持久化任务 | 中 | crontab / launchd / systemd |
| URL 短链 | 低 | 临时外泄端点 |

**高**或**严重**风险默认阻断安装，除非显式传 `--force`（需确认）或 `--skip-audit`。

## 质量门控

审查回答「安不安全」，linter 回答「好不好」。`sf lint` 按 AgentSkills 编写规范和
内容质量启发式给 skill 打 **A–F（0–100）**：

- frontmatter 完整性、description 触发清晰度（「Use when…」）
- 正文结构（何时使用 / 指令 / 示例）、标题、示例
- 臃肿/过薄、残留 TODO/占位符、断链、渐进式披露奖励

安装时传 `--min-quality <0-100>` 即可拒绝低于阈值的 skill（可 `--force` 覆盖）。
内置 catalog 全部 ≥ B 级。

## 把 SkillForge 装进你的 agent（插件形态）

SkillForge 以**多 agent 插件**形式分发。一条命令注册其 MCP 服务并拷贝 skill：

```bash
sf plugin install --agent claude-code
sf plugin install --agent hermes --global
sf plugin install --agent codex
sf plugin status
sf plugin uninstall --agent cursor
```

| Agent | skill 落地 | MCP 配置 |
|---|---|---|
| Claude Code | `.claude/skills/skillforge/` | `.mcp.json` / `~/.claude/settings.json` |
| Hermes | `.hermes/skills/skillforge/` | `~/.hermes/config.yaml`（`mcp_servers`） |
| OpenClaw | `.openclaw/skills/skillforge/` | `~/.openclaw/openclaw.json`（`mcp`） |
| Cursor | `.cursor/skills/skillforge/` | `.cursor/mcp.json` |
| Codex | `.codex/skills/skillforge/` | `.codex/config.toml`（`[mcp_servers.skillforge]`） |
| Gemini CLI | `.gemini/skills/skillforge/` | `.gemini/settings.json` |
| 通用 | `.skills/skillforge/` | `.skills/mcp.json` |

写入前会保留原内容并生成 `.skillforge-backup` 备份。

## MCP 服务

`skillforge-mcp` 是一个零依赖的 MCP 服务（stdio），向任何支持 MCP 的 agent 暴露
7 个工具：`skillforge_scan / search / plan / audit / lint / install / list`。

agent 直接调用这些工具，无需 shell。没有 MCP 时，捆绑的 skill 里写了等价的
`skillforge` CLI 命令——**CLI 和 skill 配合工作**，skill 同时教 agent 两条路。

## 离线与在线

- **离线**（`--offline`）：只用内置 catalog（`catalog/catalog.json`），从元数据合成 SKILL.md 桩。`scan` / `audit` / `plan` / 本地安装零网络可用。
- **在线**（默认）：GitHub 源逐字拉取上游真实 skill 文件。设置 `GITHUB_TOKEN` 以提升 API 限额。

## 可选的 LLM 增强

设置 `SKILLFORGE_LLM_API_KEY`（或 `OPENAI_API_KEY`）后，意图分析会由 OpenAI 兼容模型增强。
未设置则使用完全离线的启发式分析器。

## 许可证

[MIT](./LICENSE) © 2026 SkillForge
