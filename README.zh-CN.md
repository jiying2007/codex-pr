# Codex PR Safe

[English](README.md) | [简体中文](README.zh-CN.md)

在 VS Code 中根据**已经提交的 Git 变更**生成经过本地校验的 Pull Request 标题和正文，叠加确定性 provenance，并始终由用户完成最终远端写操作。

## 快速开始

适合在本次 PR 变更已经 Commit 后生成 PR Narrative。**本地 staged/unstaged 修改刻意不进入 PR range。**

环境要求：

- VS Code 1.90.0+
- Git
- 在 VS Code Extension Host 所在环境安装并登录 OpenAI Codex CLI
- 已信任、本地文件系统 Git workspace

Remote SSH、Dev Containers、Codespaces、WSL 场景下，需要在对应远端环境安装/登录 Codex，并在那里配置 `safeCodexPr.codexPath`。

### 第一次成功生成 PR

1. Commit 本次 PR 要包含的修改。
2. 确认本地 Base ref 足够新；需要时自行 `git fetch`。
3. 运行一次 **Codex PR Safe: 检查 Codex 环境**。
4. 从 Source Control 执行 **Codex PR Safe: 生成 PR**。
5. 在本地 Preview 中检查/编辑。
6. 复制 title/body 或打开 GitHub Compare。
7. 最终人工提交 PR。

如果出现 `ENOCHANGES`，先执行：

```bash
git status --short
git rev-list --count <base>..HEAD
git log --oneline <base>..HEAD
```

如果 `rev-list` 为 `0`，但 `git status` 有修改，说明这些修改还没有 Commit，因此不能属于 PR。完整排查见 [Getting Started](docs/GETTING_STARTED.zh-CN.md)。

## 核心保证

- 只分析 committed `base...HEAD`，working-tree 修改不会混入 PR evidence；
- 基于本地 refs/fork topology 保守选择 Base，不隐式 fetch/pull/push；
- 生成结构化 PR Narrative，Testing 状态由本地确定性生成；
- Native PR 与 GitHub Pull Requests provider 共用 Safe Core Semantic Context Budget；
- 可消费 Review Receipt v4 与 Commit Receipt v4 range evidence；
- HEAD/current branch/Base OID/Base ref 变化会使旧结果 stale；
- 每次 Copy/Open 前都有本地 Preview 和再次校验；
- Safe Contract v2 使用 ephemeral/read-only/no-approval，并显式关闭 shell/web/apps/multi-agent/plugins/hooks/goals/memories/dependency install；
- 不修改源码、不 Push、不自动创建/提交远端 PR。

共享安全/runtime 只来自精确 commit-pinned 的 `codex-safe-core` v4 submodule。

## Repository Policy

唯一仓库策略文件是 committed `.codex-safe.json`，必须使用 `schemaVersion: 3`：

```json
{
  "$schema": "https://raw.githubusercontent.com/jiying2007/codex-safe-core/6c0417a376179c295433c18b1b077854d290243d/codex-safe.schema.json",
  "schemaVersion": 3,
  "pr": {
    "language": "zh-CN",
    "baseBranch": "origin/main",
    "maxDiffBytes": 524288,
    "maxCommitBytes": 65536,
    "titleMaxLength": 100,
    "maxBodyChars": 8000,
    "includePullRequestTemplate": true,
    "timeoutSeconds": 120
  }
}
```

只使用 HEAD 中已提交的 Policy。PR Template 同样从 HEAD 读取且不跟随符号链接。

## Base 选择

PR Safe 只使用本地证据：有效 `baseBranch`、fork 场景的 `upstream/HEAD`、`origin/HEAD`、常见本地 ref，最后在无高置信度结果时让用户选择。不会隐式联网，也不会因为分支名中有 `/` 就猜成 remote branch。

## Family 工作流

```text
staged changes
    ↓
Codex Review Safe → Review Receipt v4
    ↓
Codex Commit Safe → Commit Receipt v4
    ↓
人工 git commit
    ↓
Codex PR Safe → PR narrative + verified provenance
    ↓
人工提交 PR
```

PR Safe 可以独立使用；存在 Review/Commit Evidence 时会得到更完整 provenance。

## 安装、升级与验证

可从 VS Code Marketplace 安装，或安装 GitHub Release 中 immutable VSIX。升级后第一次生成前建议先运行 **检查 Codex 环境**。

Release 只构建一份 VSIX，并提供 checksum + provenance attestation。见 [VERIFY_RELEASE.md](VERIFY_RELEASE.md) 与 [PUBLISHING.md](PUBLISHING.md)。

## 开发

```bash
git submodule update --init --recursive
npm ci --ignore-scripts --no-audit --no-fund
npm run ci
```

## 支持与安全

- 使用/故障排查：[SUPPORT.md](SUPPORT.md)
- 安全/漏洞报告：[SECURITY.md](SECURITY.md)
- 发布：[PUBLISHING.md](PUBLISHING.md)

## Identity

- Publisher：`jiying2007`
- Extension ID：`jiying2007.codex-pr-safe`
- Settings：`safeCodexPr.*`

## License

MIT
