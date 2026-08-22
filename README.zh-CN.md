# Codex PR Safe

[English](README.md) | [简体中文](README.zh-CN.md)

基于**已经提交的 Git 变更**生成经过本地校验的 Pull Request 标题和正文，叠加确定性 provenance，并始终由用户完成最终远端写操作。

Codex PR Safe 是 **Codex Safe Git Workflow** 产品族的 PR narrative / provenance 阶段：

```text
Codex Review Safe
      ↓ Review Receipt v4
Codex Commit Safe
      ↓ Commit Receipt v4
Codex PR Safe
      ↓ 本地预览 + 可验证 provenance
      ↓ 人工最终提交
```

所有共享安全与运行时基础设施只来自固定 commit 的 [`codex-safe-core`](https://github.com/jiying2007/codex-safe-core) Git submodule。

## 核心能力

- 只分析已提交的 `base...HEAD`；本地 staged/unstaged working-tree 修改不会混入。
- 基于本地 Git refs 和 fork topology 保守选择 Base，不隐式联网。
- 生成结构化 PR title / summary / changes / risks / review notes，支持简体中文和英文。
- 主 PR 命令与 GitHub Pull Requests title/description provider **统一使用 Safe Core Semantic Context Budget**。
- Testing 状态由本地确定性生成，模型不能声称未验证的测试成功。
- 消费 Codex Review Safe range evidence。
- 消费 Codex Commit Safe range evidence，并展示经过重新验证的 Commit provenance。
- HEAD、当前分支、Base OID、Base ref 变化时拒绝 stale result。
- Copy/Open 前提供本地可编辑预览，并再次校验仓库状态。

## 明确不会做的事

- 不隐式执行 `git fetch` / `git pull` / `git push`。
- 不自动创建或提交远端 Pull Request。
- 不修改项目源码。
- 不给 Codex Shell 权限。
- 不给 Codex 网络/Web Search 权限。
- 不把 AI Review Receipt 当成人工批准。
- 不把生成文案当成测试证据。

## 安全边界

Safe Core v3 要求 Codex CLI 具备：

- `--ask-for-approval never`
- `exec --json`
- ephemeral execution
- 本次请求忽略用户/项目 Codex rules
- read-only sandbox
- Structured Output schema
- 显式关闭 shell、unified exec、web search、apps、hooks、memories、multi-agent 等无关能力

缺失必要安全能力时直接 fail closed 并要求升级；**不存在 legacy CLI fallback**。

Diff、Commit Message、文件名、PR Template、仓库策略、历史生成结果等仓库派生文本全部视为不可信数据，不能覆盖安全/证据规则。

## 大型 PR 的 Semantic Context

`maxDiffBytes` 表示**模型 Semantic Context 预算**，不是“取前 N 字节”或“超过就直接拒绝”的阈值。

Safe Core 按 unified diff 文件块处理：

- source 文件公平分配预算；
- generated/lock 文件只保留元数据；
- binary 文件只保留元数据；
- 过大的 source 文件保留受控头尾上下文；
- 主 PR 路径的原始 diff 固定 8 MiB 安全上限；
- GitHub Pull Requests provider 的 patch context 使用同一套语义预算策略。

Commit list 另有独立 `maxCommitBytes` 上限。

## 唯一仓库策略文件

仓库只认 `.codex-safe.json`，且必须使用 `schemaVersion: 3`。

```json
{
  "$schema": "https://raw.githubusercontent.com/jiying2007/codex-safe-core/4dc4de836625a8b70084531eb3321734eca675d0/codex-safe.schema.json",
  "schemaVersion": 3,
  "pr": {
    "language": "zh-CN",
    "baseBranch": "upstream/main",
    "maxDiffBytes": 524288,
    "maxCommitBytes": 65536,
    "titleMaxLength": 100,
    "maxBodyChars": 8000,
    "includePullRequestTemplate": true,
    "extraInstructions": "使用简洁工程语言；存在迁移影响时明确说明。",
    "timeoutSeconds": 120
  }
}
```

只使用 **HEAD 中已提交的策略**。PR Template 同样只从 HEAD 读取，且不会跟随符号链接。

仓库策略不能选择 Codex executable 或 model。`safeCodexPr.codexPath` 为 machine scope，其余用户偏好为 application scope。

## Base 与 Fork 行为

Codex PR Safe 不会联网发现分支，而是按本地证据：

1. 有效的 `baseBranch`；
2. fork 场景优先本地 `upstream/HEAD`；
3. 本地 `origin/HEAD` / `upstream/HEAD`；
4. `origin/main`、`upstream/main`、`main`、`master`、`develop`、`dev` 等常见本地 refs；
5. 无高置信度 Base 时询问用户，而不是猜测。

分支名中的 `/` 不等于 remote。`release/1.0` 只有在 `release` 真的是已配置 remote 时才按 remote branch 解析。

GitHub Compare 使用本地 Git remote/branch 配置解析当前分支 push target；插件只验证拓扑，不替用户 push。

## Review 与 Commit Provenance

PR Safe 使用两个独立本地证据通道。

### Review evidence

Codex Review Safe 会把历史 Review Receipt v4 与真正 first-parent commit diff 重新匹配，返回 reviewed / blocked 等覆盖信息。

### Commit provenance

Codex Commit Safe 在生成 Commit Message 后保存 pending Commit Receipt v4。PR 查询 range evidence 时，会重新计算每个 first-parent commit 的：

- parent HEAD；
- 完整 commit diff；
- 最终 Git commit message。

只有 fingerprint 完全匹配，pending receipt 才绑定真实 `commitOid`。

因此 PR Safe 可以确定性展示：

- 当前 PR 中有多少 commit 仍能证明由 Codex Commit Safe 生成；
- 这些 generated commits 中有多少同时绑定了匹配的 Codex Review Safe Receipt fingerprint。

修改 Commit Message、提交内容或父提交都会自动使 provenance 失效。

这些 Receipt 是 AI 工作流证据，不等于人工批准、构建证据或测试证据。

## 确定性 PR 正文

模型只返回结构化 narrative 字段，最终 Markdown 在本地生成，Testing 状态也由本地固定：

```text
## 摘要
- ...

## 主要变更
- ...

## 测试
- Codex PR Safe 未验证测试执行结果。

## 风险
- ...
- 风险等级: 低/中/高
- 破坏性变更: 是/否

## Review 重点
- ...

## 审查证据
- 存在时展示确定性 Receipt 覆盖

## Commit Provenance
- 存在时展示确定性 Commit Receipt 覆盖
```

Base...Head compare range 单独追加。

## 预览与 stale result 防护

生成完成前以及每一次 Copy/Open 前都会验证：

```text
HEAD OID + current branch + Base OID + Base ref
```

任一项变化都会使结果 stale，必须重新生成。

“打开 GitHub”只打开 Compare 页面并复制已经人工检查的 title/body，不会自动提交远端 PR。

## GitHub Pull Requests Provider

当 `GitHub.vscode-pull-request-github` 暴露 title/description provider API 时，Codex PR Safe 可以注册 provider，但不把该扩展设为硬依赖。

Provider 路径与主 PR 命令使用同一个 Safe Core Codex contract 和 Semantic Context Budget。模型输入会主动省略本地 file URI metadata 与 issue content。

## 使用

1. Commit 本次 PR 应包含的变更。
2. 确认本地 Base ref 足够新；需要时自行执行 `git fetch`。
3. 打开 **Source Control**。
4. 执行 **Codex PR Safe: 生成 PR**。
5. 在本地预览中检查/编辑。
6. 复制 title/body 或打开 GitHub Compare。
7. 最终人工确认后提交 PR。

## 环境要求

- VS Code `1.90.0` 或更高版本
- Git
- 在工作区 Extension Host 所在环境安装并登录 OpenAI Codex CLI
- 已信任、基于本地文件系统的 Git workspace

## 构建与测试

```bash
git submodule update --init --recursive
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run test:integration
npm run package
```

Marketplace / Release 运行入口统一为 `dist/extension.js`。VSIX 只包含 `dist/` 下的确定性生产运行时、`dist/codex-safe.schema.json`、本地化、图标和发布文档；源码、tests、scripts、submodule metadata 一旦进入 VSIX，CI 直接失败。

CI 门禁包括：

- static/contract/provider；
- unit/regression；
- Linux / Windows / macOS Extension Host；
- 最低 VS Code `1.90.0`；
- 简体中文本地化 smoke；
- 官方 VSIX 边界审计与 SHA-256。

## 发布完整性

`main` 上版本变更触发完整 Release gate。只有 validation 与 integration 全部通过后才创建不可变 Tag 和 GitHub Release。

发布资产包括：

- `codex-pr-safe-<version>.vsix`
- `SHA256SUMS`
- 两个资产对应的 GitHub build-provenance attestation

只有最终 Release job 拥有 `contents: write`、`id-token: write`、`attestations: write`；其他验证 job 只读。Actions 使用完整 commit SHA 固定。

详见 [SECURITY.md](SECURITY.md) 与 [PUBLISHING.md](PUBLISHING.md)。

## 产品族边界

| 产品 | 职责 | 明确不做 |
| --- | --- | --- |
| Codex Review Safe | staged-change 质量门禁 + Review Receipt | 写代码 / commit |
| Codex Commit Safe | Commit Message + 可验证 Commit Receipt | commit / push |
| **Codex PR Safe** | PR narrative + 可验证 provenance | push / 自动提交 PR |

设计原则：**AI 辅助 Git 工作流，但不把 Git 控制权交给 AI。**

## License

MIT
