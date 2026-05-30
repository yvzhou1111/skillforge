# SkillForge

[English](./README.md) · [简体中文](./README.zh-CN.md) · **日本語**

> Agent Skills のためのインテリジェントな依存関係マネージャー。
> プロジェクトと意図を読み取り、オープンソースの skill エコシステムから候補を発掘し、
> 各候補を**セキュリティ監査**したうえで、選び抜いた組み合わせを任意のエージェント
> （Claude Code、Cursor、Codex、Gemini、Hermes、OpenClaw）にインストールします。

SkillForge は「単なる skill ディレクトリ」ではなく、目標を「インストール済み・監査済み」の
能力に変える**オーケストレーター**です。

```
スキャン(技術スタック) + 意図(自然言語)
        │
        ▼
   計画  ──►  監査  ──►  インストール  ──►  lockfile
 (ランク+理由) (セキュリティ) (エージェント別)  (監査可能な記録)
```

## なぜ必要か

2025〜2026 年、`SKILL.md` 標準に基づく Agent Skills のエコシステムが急成長しました。
`anthropics/skills`、`vercel-labs/skills`(skills.sh)、`VoltAgent/awesome-agent-skills`(700+)
などに数万の skill が存在します。既存ツールには 4 つの共通課題があり、SkillForge はそれを埋めます。

1. **発見がキーワード検索止まり**。SkillForge は*プロジェクト*と*自然言語の目標*から
   ニーズを推論し、組み合わせを計画します。
2. **誰も監査しない**。skill は実行スクリプトやツールフックを含み得ます。SkillForge は
   ディスクに書く前に**静的セキュリティ監査**を行い、高・重大リスクを既定でブロックします。
3. **マルチエージェント導入が煩雑**。1 度の発見で、プラグイン式アダプタにより任意の
   エージェントへインストールできます。
4. **ライフサイクル管理がない**。SkillForge は監査・更新確認のため `skillforge.lock.json` を書き込みます。

## インストール

npm 公開後はインストール不要で利用できます。

```bash
npx skillforge-butler <コマンド>       # CLI（パッケージ名は skillforge-butler）
npx -p skillforge-butler skillforge-mcp   # MCP サーバー（エージェント用）
```

グローバルインストール（`skillforge`、`sf`、`skillforge-mcp` を提供）：

```bash
npm install -g skillforge-butler
skillforge --help             # エイリアス `sf` も可
```

ソースから（開発）：

```bash
npm install
npm run build
npm link
node dist/cli.js <コマンド>
```

## クイックスタート

```bash
# 1. プロジェクトに必要なものを確認
sf scan

# 2. 目標に対する推奨を表示（インストールしない）
sf plan "決済と多言語対応の越境ECサイトを作る" --dry-run

# 3. 一括実行：スキャン → 計画 → 監査 → Claude Code へインストール
sf auto "決済と多言語対応の越境ECサイトを作る" --agent claude-code

# 4. サードパーティ skill を信頼する前に監査
sf audit some-owner/some-repo/skills/their-skill

# 5. エコシステムを検索
sf search "playwright e2e テスト"
```

## コマンド

| コマンド | 役割 |
|---|---|
| `sf scan` | 技術スタックを検出 → 能力ニーズ |
| `sf search "<クエリ>"` | 関連度+品質（インストール数/star/信頼度）で検索 |
| `sf plan ["<意図>"]` | 理由と競合検出付きで skill の組み合わせを推奨 |
| `sf audit <id\|--dir パス>` | skill の静的セキュリティ監査 |
| `sf lint <id\|--dir パス>` | skill の品質評価（A–F） |
| `sf install <id> --agent <a>` | 監査 + 単一 skill のインストール |
| `sf auto ["<意図>"]` | 全工程：スキャン → 計画 → 監査 → インストール |
| `sf list` | lockfile のインストール済み skill を表示 |
| `sf update` | 上流の変更を確認 |
| `sf init <名前>` | 新しい `SKILL.md` の雛形を生成 |
| `sf plugin <install\|...>` | SkillForge 自身をエージェントへ導入（skill + MCP） |
| `sf mcp` | SkillForge MCP サーバー（stdio）を起動 |

`sf help` で全オプションを表示します。

## セキュリティ監査

SkillForge の中核的な差別化要素です。静的監査（`src/core/auditor.ts`）は次のようなパターンを検出します。

| ルール | リスク | 検出内容 |
|---|---|---|
| `curl \| sh` | 重大 | リモートコード実行のワンライナー |
| base64 → shell | 重大 | 難読化ペイロード |
| `rm -rf` | 高 | 破壊的削除 |
| `sudo` | 高 | 権限昇格 |
| 機密ファイル | 高 | `.env`、`id_rsa`、`~/.ssh`、認証情報 |
| 外部リクエスト | 高 | データ流出の可能性 |
| ツールフック | 高 | `PreToolUse`/`PostToolUse` 登録 |
| home への書き込み | 中 | グローバル設定の改ざん |
| `chmod 777` | 中 | 権限の弱体化 |
| 永続タスク | 中 | crontab / launchd / systemd |
| URL 短縮 | 低 | 一時的な流出先 |

**高**・**重大**のリスクは、明示的な `--force`（確認付き）または `--skip-audit` がない限り
インストールをブロックします。

## 品質ゲート

監査が「安全か」を、linter が「良質か」を答えます。`sf lint` は AgentSkills の記述規約と
内容品質ヒューリスティクスに基づき **A–F（0〜100）** で評価します。

- frontmatter の完全性、description のトリガー明確性（「Use when…」）
- 本文の構造（使用タイミング / 手順 / 例）、見出し、例
- 冗長/薄さ、TODO/プレースホルダー残り、リンク切れ、段階的開示のボーナス

インストール時に `--min-quality <0-100>` を渡すと、しきい値未満の skill を拒否できます
（`--force` で上書き可）。内蔵カタログはすべて B 以上です。

## SkillForge をエージェントへ導入（プラグイン形態）

SkillForge は**マルチエージェントプラグイン**として配布されます。1 コマンドで MCP サーバーを
登録し skill をコピーします。

```bash
sf plugin install --agent claude-code
sf plugin install --agent hermes --global
sf plugin install --agent codex
sf plugin status
sf plugin uninstall --agent cursor
```

| エージェント | skill の配置 | MCP 設定 |
|---|---|---|
| Claude Code | `.claude/skills/skillforge/` | `.mcp.json` / `~/.claude/settings.json` |
| Hermes | `.hermes/skills/skillforge/` | `~/.hermes/config.yaml`（`mcp_servers`） |
| OpenClaw | `.openclaw/skills/skillforge/` | `~/.openclaw/openclaw.json`（`mcp`） |
| Cursor | `.cursor/skills/skillforge/` | `.cursor/mcp.json` |
| Codex | `.codex/skills/skillforge/` | `.codex/config.toml`（`[mcp_servers.skillforge]`） |
| Gemini CLI | `.gemini/skills/skillforge/` | `.gemini/settings.json` |
| 汎用 | `.skills/skillforge/` | `.skills/mcp.json` |

書き込み前に既存内容を保持し `.skillforge-backup` を作成します。

## MCP サーバー

`skillforge-mcp` は依存ゼロの MCP サーバー（stdio）で、MCP 対応の任意エージェントに
7 つのツールを公開します：`skillforge_scan / search / plan / audit / lint / install / list`。

エージェントはこれらを直接呼び出します（シェル不要）。MCP がない場合でも、同梱の skill に
同等の `skillforge` CLI コマンドが記載されており、**CLI と skill が連携**します。

## オフラインとオンライン

- **オフライン**（`--offline`）：内蔵カタログのみを使用し、メタデータから SKILL.md を合成。
  `scan` / `audit` / `plan` / ローカルインストールはネットワーク無しで動作します。
- **オンライン**（既定）：GitHub ソースが上流の実ファイルを取得。`GITHUB_TOKEN` で API 制限を緩和。

## 任意の LLM 強化

`SKILLFORGE_LLM_API_KEY`（または `OPENAI_API_KEY`）を設定すると、意図分析が
OpenAI 互換モデルで強化されます。未設定でも完全オフラインのヒューリスティック分析が動作します。

## ライセンス

[MIT](./LICENSE) © 2026 SkillForge
