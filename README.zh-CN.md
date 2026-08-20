# Codex PR Safe

[English](README.md) | 简体中文

Codex PR Safe 是一个 VS Code 扩展：基于**已经提交到当前 Git 分支的变更**，调用本地 OpenAI Codex CLI，生成可审阅的 Pull Request 标题和正文。

它定位为 **Codex Commit Safe** 与 **Codex Review** 的 PR 配套工具：Git 输入确定、Codex 输出结构化、本地格式化、结果过期即拒绝，并且不会自动对远端创建或修改 PR。

## 能做什么

- 将当前分支与选定的本地 Git Base ref（例如 `origin/main`）进行比较。
- 只读取已提交范围：`merge-base`、提交列表、diff stat、name status 和文本 diff。
- 明确排除本地 staged / unstaged 未提交改动，避免把“还没进分支的内容”写进 PR。
- 结构化生成：标题、摘要、主要变更、测试、风险、Review 重点、风险等级、破坏性变更标志。
- PR Markdown 在插件本地格式化，不让模型自由输出不可控模板。
- 生成后提供可编辑预览，再决定复制或打开 GitHub。
- 生成语言支持简体中文和 English，与 VS Code UI 语言相互独立。
- 在本地 remote 可识别时，支持同仓库和 fork 的 GitHub Compare URL。
- 不会自动执行 `fetch`、`push`、创建 PR、更新 PR 或提交任何远端写操作。

## 安全模型

Codex PR Safe 采用偏保守的边界：

1. **只支持受信任的本地工作区**：Restricted Mode 和虚拟工作区不支持。
2. **只分析已提交范围**：本地 staged / unstaged 改动不会混入 PR 描述。
3. **不隐式执行 Git 网络操作**：不会自动 `fetch` / `pull` / `push`；Base 只来自本地已有 refs。
4. **Codex 只读运行**：在空临时目录运行，`read-only` sandbox、禁止审批、关闭 Web Search，并关闭 shell / app / multi-agent 等能力。
5. **Prompt Injection 边界**：diff、文件名、Commit Message、PR 模板、历史生成结果、仓库配置都被明确视为不可信数据。
6. **结构化输出**：Codex 必须匹配封闭 JSON Schema；插件验证后再在本地生成 Markdown。
7. **测试结论必须有证据**：没有输入证据时禁止声称“测试已通过”，最终正文会明确写未验证测试执行信息。
8. **结果过期保护**：采集前、采集后、使用结果前都校验 `HEAD OID + Base OID + Base ref`；发生变化就丢弃结果。
9. **不自动写远端 PR**：点击“打开 GitHub PR”只会复制当前可编辑标题/正文，再打开 GitHub Compare 页面，由你最终确认提交。
10. **不记录敏感内容**：Output Channel 不记录源码 diff、提交内容、生成 PR 文本或仓库路径。

组织管理的 Codex Policy 仍可能生效，插件不会绕过它。

## 环境要求

- VS Code 1.90.0+
- Git
- VS Code 环境中可执行的 OpenAI Codex CLI
- 已信任的本地 Git 工作区

先确认：

```bash
codex --version
```

## 主要命令

Command Palette 中提供：

- `Codex PR Safe: 生成 PR`
- `Codex PR Safe: 重新生成 PR`
- `Codex PR Safe: 选择 Base 并生成 PR`
- `Codex PR Safe: 显示上次 PR`
- `Codex PR Safe: 复制 PR 标题`
- `Codex PR Safe: 复制 PR 正文`
- `Codex PR Safe: 复制 PR 标题与正文`
- `Codex PR Safe: 打开 GitHub PR`
- `Codex PR Safe: 检查环境`

Source Control 标题栏同时提供 **Generate PR**（`git-pull-request`）和 **Regenerate PR**（`redo`）图标，避免和 Git 原生 Refresh 混淆。

## Base 选择逻辑

插件不会联网查询远端默认分支，只使用本地 refs：

1. 已配置的 `safeCodexPr.baseBranch` / `.codex-pr.json`。
2. 本地 `origin/HEAD` 或 `upstream/HEAD`。
3. `origin/main`、`origin/master`、`upstream/main`、`main`、`master`、`develop`、`dev` 等常见 refs。
4. 其他可用本地/远端分支 ref。

需要明确控制时使用 **选择 Base 并生成 PR**。

如果本地 remote refs 可能过期，请自己先执行 `git fetch`；插件故意不替你执行网络操作。

## 生成预览

生成后会打开可编辑预览：

- PR 标题
- PR 正文
- Base...Head 比较范围
- 存在本地未提交改动时的明确提示
- 复制标题 / 复制正文 / 复制全部
- 重新生成
- 更换 Base
- 打开 GitHub PR

“打开 GitHub PR”不会提交 PR。当前分支必须已经推送到插件能从本地 refs 识别出的 GitHub remote，否则按钮不可用。

## 配置

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `safeCodexPr.codexPath` | `codex` | 本地 Codex CLI 路径，仅用户可配置 |
| `safeCodexPr.model` | 空 | 可选模型覆盖，仅用户可配置 |
| `safeCodexPr.language` | `zh-CN` | 生成语言：`zh-CN` / `en` |
| `safeCodexPr.baseBranch` | 空 | 可选默认 Base，例如 `origin/main` |
| `safeCodexPr.maxDiffBytes` | `524288` | 发送给 Codex 的文本 diff 最大字节数 |
| `safeCodexPr.maxCommitBytes` | `65536` | 提交列表最大上下文字节数 |
| `safeCodexPr.titleMaxLength` | `100` | PR 标题建议最大长度 |
| `safeCodexPr.maxBodyChars` | `8000` | PR 正文最大长度 |
| `safeCodexPr.includePullRequestTemplate` | `true` | 将小型 PR 模板作为不可信参考输入 |
| `safeCodexPr.extraInstructions` | 空 | 团队风格要求，不能覆盖安全/证据规则 |
| `safeCodexPr.timeoutSeconds` | `120` | 生成超时时间 |

仓库配置不能覆盖 `codexPath` 和 `model`。

## 可选仓库配置

仓库可加入 `.codex-pr.json`：

```json
{
  "language": "zh-CN",
  "baseBranch": "origin/main",
  "titleMaxLength": 90,
  "maxBodyChars": 7000,
  "includePullRequestTemplate": true,
  "extraInstructions": "使用简洁工程语言；存在迁移影响时明确说明。"
}
```

未知字段直接拒绝。

## PR 正文结构

最终 Markdown 由插件本地生成：

```text
## 摘要
- ...

## 主要变更
- ...

## 测试
- ...

## 风险
- ...
- 风险等级: 低/中/高
- 破坏性变更: 是/否

## Review 重点
- ...
```

正文末尾还会记录本地 Base...Head 比较范围。

## 大型 PR

diff 超过配置上限时**直接拒绝生成**，不会静默截断后假装已经理解整个 PR。确认 PR 规模合理后，可以主动提高 `safeCodexPr.maxDiffBytes`，但仍受硬上限约束。

## VSIX 安装

```bash
code --install-extension codex-pr-safe-1.0.0.vsix
```

## Codex Safe 工作流

```text
Code
  ↓
Codex Review
  ↓
Codex Commit Safe
  ↓
Codex PR Safe
  ↓
人工 Review / GitHub 最终提交
```

## License

MIT，见 [LICENSE](LICENSE)。
