# SkillForge 需求文档（REQUIREMENTS）

> SkillForge —— 面向 AI 编程 Agent 的「智能 Skill 依赖管家」。
> 它读懂你的项目与意图，从开源生态自动挖掘相关 Agent Skills，做安全审查后，
> 一键落地到你指定的 Agent（Claude Code / Cursor / Codex / Gemini CLI 等）。

版本：v0.1（MVP）
日期：2026-05-30

---

## 1. 背景与问题

2026 年初，Agent Skills（基于 `SKILL.md` 标准的可复用能力包）已经形成庞大生态：
`anthropics/skills`、`vercel-labs/skills`(skills.sh)、`VoltAgent/awesome-agent-skills`(700+)
等仓库与目录中存在数万计的 skill。但现有工具存在四个共性缺口：

1. **「发现」停留在关键词检索**：用户必须自己想关键词（`npx skills find react`），
   无法根据「项目实际技术栈 + 自然语言意图」自动推断需要哪些 skill。
2. **缺少安全审查**：skill 可携带可执行脚本、`PreToolUse` hook、外联 URL，
   绝大多数安装器在安装前不做静态审查，存在真实攻击面（SSRF、敏感文件读取、任意命令执行）。
3. **多 Agent 落地不统一**：不同 Agent 的 skill 目录结构与格式不同，
   少有工具能做到「一次发现 → N 个 Agent 落地」。
4. **缺少持续演进闭环**：装完即结束，没有 lockfile、没有更新检查、没有闲置归档。

## 2. 产品定位

不是「又一个 skill 目录」，而是一个 **orchestrator（编排器）**：

```
意图/项目理解 → 语义挖掘 → 组合规划 → 安全审查 → 多 Agent 落地 → 持续演进
```

价值集中在两端：**前端「意图 → skill 组合规划」** 与 **后端「安全审查 + 多 Agent 落地」**。
索引底座复用现有生态（skills.sh / GitHub / awesome 仓库），不自建语料。

## 3. 目标用户

- 个人开发者：希望快速为当前项目配齐合适的 skill，而不必手动逐个搜索。
- 团队 / 企业：关心 skill 的安全与可治理性，需要安装前审查与可审计的 lockfile。
- Agent 本身：SkillForge 同时提供一个 meta-skill，使任意 Agent 可调用本工具。

## 4. 术语

| 术语 | 含义 |
|---|---|
| Skill | 含 `SKILL.md`（YAML frontmatter + Markdown 正文）的能力包，可含脚本/资源 |
| Source | skill 的来源（本地内置目录、GitHub、skills.sh 等） |
| Catalog | 经过整理的精选 skill 索引（内置 + 远程聚合） |
| Agent Adapter | 把 skill 落地到具体 Agent 的适配器（决定目录结构/格式） |
| Lockfile | `skillforge.lock.json`，记录已装 skill 的来源、版本、校验值 |
| Capability Need | 由扫描/意图分析得出的结构化「能力需求项」 |

---

## 5. 功能性需求（FR）

采用 EARS 风格描述（WHEN/IF ... THE SYSTEM SHALL ...）。

### FR-1 项目扫描（scan）
- FR-1.1 WHEN 用户在项目目录运行 `scan`，THE SYSTEM SHALL 检测技术栈
  （读取 `package.json`、`go.mod`、`requirements.txt`/`pyproject.toml`、`Cargo.toml`、
  `pom.xml`、`Gemfile`、`composer.json`、framework 配置文件等）。
- FR-1.2 THE SYSTEM SHALL 将检测结果归一化为 `CapabilityNeed[]`（如 react / testing / docker / i18n）。
- FR-1.3 IF 目录无可识别的依赖文件，THE SYSTEM SHALL 退化为基于文件扩展名与目录结构的启发式检测，并提示置信度较低。

### FR-2 搜索 / 挖掘（search）
- FR-2.1 WHEN 用户运行 `search <query>`，THE SYSTEM SHALL 跨已注册 Source 检索 skill。
- FR-2.2 THE SYSTEM SHALL 对候选按相关度 + 质量信号（installs / stars / 来源信誉 / 更新时间）综合排序。
- FR-2.3 IF 无网络或远程 Source 不可用，THE SYSTEM SHALL 至少返回内置 Catalog 的结果，并标注「离线模式」。

### FR-3 组合规划（plan）
- FR-3.1 WHEN 用户运行 `plan`（可附带自然语言意图与/或 scan 结果），
  THE SYSTEM SHALL 产出一份「推荐 skill 组合」清单，每项含：名称、来源、相关度、推荐理由。
- FR-3.2 THE SYSTEM SHALL 对推荐结果去重，并标记潜在冲突（同名/同功能/路径冲突）。
- FR-3.3 IF 配置了 LLM API Key，THE SYSTEM SHALL 使用 LLM 增强意图拆解；ELSE 使用本地启发式评分器（保证离线可用）。

### FR-4 安全审查（audit）—— 核心差异点
- FR-4.1 WHEN 对某个 skill 执行 `audit`，THE SYSTEM SHALL 静态扫描其 `SKILL.md` 与随附脚本。
- FR-4.2 THE SYSTEM SHALL 至少检测以下风险并分级（info/low/medium/high/critical）：
  - 危险 shell 命令（`rm -rf`、`curl | sh`、`sudo`、`chmod 777` 等）
  - `PreToolUse`/`PostToolUse` hook 写入与权限提升
  - 外联 URL / 数据外传 / SSRF 风险
  - 敏感文件访问（`.env`、`id_rsa`、`~/.ssh`、credential 等）
  - 向 home 目录跨平台写配置
  - 可疑/疑似 typosquatting 的依赖安装
- FR-4.3 IF 审查发现 `high` 及以上风险，THE SYSTEM SHALL 在安装前阻断并要求显式确认。

### FR-5 安装 / 落地（install）
- FR-5.1 WHEN 用户运行 `install <skill>` 并指定 `--agent <target>`，
  THE SYSTEM SHALL 通过对应 Agent Adapter 将 skill 落地到正确目录与格式。
- FR-5.2 THE SYSTEM SHALL 在安装前自动执行 audit（除非 `--skip-audit`），高危需确认。
- FR-5.3 THE SYSTEM SHALL 支持作用域：`--project`（默认）或 `--global`。
- FR-5.4 THE SYSTEM SHALL 将安装结果写入 lockfile（来源、commit/版本、内容校验、目标 agent）。
- FR-5.5 至少支持 Adapter：`claude-code`、`cursor`、`codex`、`gemini`、`generic`。

### FR-6 列表 / 状态（list）
- FR-6.1 WHEN 用户运行 `list`，THE SYSTEM SHALL 展示当前 lockfile 中已安装 skill 及其 agent/作用域/版本。

### FR-7 更新检查（update / check）
- FR-7.1 WHEN 用户运行 `update`，THE SYSTEM SHALL 比对已装 skill 与来源最新版本并提示可更新项。

### FR-8 meta-skill 与可被 Agent 调用
- FR-8.1 THE SYSTEM SHALL 随包提供一个 `SKILL.md`（meta-skill），描述何时/如何调用 SkillForge CLI，
  使任意支持 SKILL.md 的 Agent 都能把它当作「发现并安装 skill」的入口。

### FR-9 端到端便捷命令（auto）
- FR-9.1 WHEN 用户运行 `auto "<意图>"`，THE SYSTEM SHALL 串联 scan → plan → audit → install
  的完整闭环，并在落地前给出可确认的总览。

---

## 6. 非功能性需求（NFR）

- NFR-1 **离线可用**：无 API Key / 无网络时核心流程（scan/audit/internal-catalog plan/install 本地 skill）仍可运行。
- NFR-2 **安全优先**：默认安装前审查；任何会执行脚本/写 hook 的操作需要明确提示。
- NFR-3 **可审计**：所有安装写入 lockfile，记录来源与校验值，便于回溯。
- NFR-4 **可扩展**：Source 与 Agent Adapter 均为插件式接口，新增来源/Agent 不改核心。
- NFR-5 **跨平台**：macOS / Linux / Windows（路径与 home 目录处理需兼容）。
- NFR-6 **零重型依赖**：MVP 不强制向量数据库；本地评分器即可工作。
- NFR-7 **可测试**：核心逻辑（scan/audit/scorer/frontmatter）具备单元测试。

## 7. 范围边界

### MVP 包含
scan / search / plan / audit / install / list / update / init / auto 九个命令；
内置精选 Catalog + GitHub Source；claude-code / cursor / codex / gemini / generic 五个 Adapter；
本地启发式评分器；规则 + 可选 LLM 复核的审查器；lockfile。

### MVP 暂不包含（后续迭代）
- 向量数据库与大规模 embedding 检索（先用本地 BM25/词重叠）。
- Web UI / 可视化目录站。
- skill 自动生成（交给相邻工具如 Skill_Seekers）。
- 项目变更的实时监听（先做手动 `update`）。

## 8. 与现有开源项目的整合策略

| 现有项目 | 我们如何整合 / 复用 |
|---|---|
| `vercel-labs/skills` (skills.sh) | 作为远程 Source 之一；命令风格对齐 `find/add` 习惯 |
| `anthropics/skills` | 作为内置 Catalog 的权威条目；SKILL.md 规范蓝本 |
| `VoltAgent/awesome-agent-skills` | 作为聚合索引来源，扩充候选池 |
| `numman-ali/openskills` | 借鉴三层渐进式加载与多 agent loader 思路 |
| arXiv 2603.11808（稠密检索挖掘） | 匹配层的理论蓝图：dense retrieval + rerank（MVP 先用轻量替代） |
| `awesome-skills.com` 风险评分 | 启发安全审查层的风险维度设计 |

## 9. 验收标准（Acceptance）

- AC-1 在一个含 `package.json`(react/next) 的项目中运行 `scan`，能识别出 react/nextjs/testing 等需求。
- AC-2 `plan "做一个带支付的跨境电商"` 能产出包含 i18n / 支付安全 / SEO 等方向的 skill 组合及理由。
- AC-3 对一个内含 `curl | sh` 的恶意 SKILL.md 运行 `audit`，能报出 `high/critical` 风险并在安装时阻断。
- AC-4 `install <skill> --agent claude-code` 能把 skill 落到 `.claude/skills/<name>/` 并写入 lockfile。
- AC-5 关闭网络后，`scan` / `audit` / 内置 catalog 的 `plan` / 安装本地 skill 仍可运行。
- AC-6 `npm run build` 与 `npm test` 通过。
