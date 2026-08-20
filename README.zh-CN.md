# Codex PR Safe

[English](README.md) | 简体中文

Codex PR Safe 是一个 VS Code 扩展：基于**已经提交到当前 Git 分支的变更**，调用本地 OpenAI Codex CLI，生成可审阅的 Pull Request 标题和正文。

它定位为 **Codex Commit Safe** 与 **Codex Review** 的 PR 配套工具：Git 输入确定、Codex 输出结构化、本地格式化、结果过期即拒绝，并且不会自动对远端创建或修改 PR。

## 能做什么

- 将当前分支与选定的本地 Git Base ref 进行比较。
- 只读取已提交范围：merge-base、提交列表、diff stat、name status 和文本 diff。
- 本地 staged / unstaged 未提交改动不会混入 PR 分析。
- 结构化生成标题、摘要、主要变更、风险、Review 重点、风险等级和破坏性变更标志。
- **测试执行状态由插件本地确定**：当前没有可信测试运行证据源，因此固定明确标记“未验证”，模型不能声称“测试已通过”。
- PR Markdown 在插件本地格式化，并提供可编辑预览。
- 生成语言支持简体中文和 English，与 VS Code UI 语言相互独立。
- 在本地 remote 可识别时支持同仓库和 fork 的 GitHub Compare URL。
- 不会自动执行 `fetch`、`push`、创建 PR、更新 PR 或提交任何远端写操作。

## 安全模型

Codex PR Safe 采用偏保守的边界：

1. **只支持受信任的本地工作区**：Restricted Mode 和虚拟工作区不支持。
2. **只分析已提交范围**：PR 源数据来自已提交的 `base...HEAD`；本地 staged / unstaged 改动被排除。
3. **仓库控制输入也只读 HEAD**：`.codex-pr.json` 与 PR Template 从 `HEAD` Git object 读取，而不是读取 working tree；仓库符号链接不会被跟随。
4. **不隐式执行 Git 网络操作**：不会自动 `fetch` / `pull` / `push`；Base 只来自本地已有 refs。
5. **Codex 只读运行**：在空临时目录运行，`read-only` sandbox、禁止审批、关闭 Web Search，并关闭 shell / app / multi-agent 等能力。
6. **CLI 能力预检**：生成前检查 `codex --help` 与 `codex exec --help` 是否暴露插件所需的安全和结构化输出能力，并按 executable/version 缓存结果。
7. **Prompt Injection 边界**：diff、文件名、Commit Message、PR Template、历史生成结果、仓库配置都被明确视为不可信数据。
8. **结构化输出**：Codex 必须匹配封闭 JSON Schema；摘要和主要变更不能为空，中/高风险必须给出具体风险。
9. **测试状态确定性**：插件没有接入已验证的测试运行结果，因此不会让模型输出“测试通过”；Testing 区域由插件本地固定生成“未验证”。
10. **结果过期保护**：生成过程中校验 `HEAD OID + Base OID + Base ref`，并在每一次 Copy/Open 对外输出前再次校验；一旦过期，预览会禁用 Copy/Open，直到重新生成。
11. **不自动写远端 PR**：点击“打开 GitHub PR”只会复制当前可编辑标题/正文，再打开 GitHub Compare 页面，由你最终确认提交。
12. **Output 不记录敏感内容**：持久 Output Channel 只记录生命周期和错误代码，不记录源码 diff、Commit 内容、生成 PR 文本、原始 Codex stderr 或仓库路径。

组织管理的 Codex Policy 仍可能生效，插件不会绕过它。

## 环境要求

- VS Code 1.90.0+
- Git
- VS Code 环境中可执行的 OpenAI Codex CLI
- 已信任的本地 Git 工作区

先确认：

```bash
codex --version
codex --help
codex exec --help
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

插件不会联网查询远端默认分支，选择规则刻意保持保守：

1. 有效的 `safeCodexPr.baseBranch` / 已提交 `.codex-pr.json` 明确配置优先。
2. 检测到典型 fork 拓扑（`origin` 是 fork，`upstream` 是不同 GitHub 仓库）时，优先本地 `upstream/HEAD`。
3. 其他情况优先本地 `origin/HEAD`，然后 `upstream/HEAD`。
4. 再考虑 `origin/main`、`upstream/main`、`main`、`master`、`develop`、`dev` 等常见 refs。
5. **没有高置信度 Base 时不再随便取第一个分支**，而是要求手动选择。

分支名包含 `/` 不再被自动当作 remote。例如本地分支 `release/1.0` 会保持为完整本地分支，除非 `release` 本身确实是已配置的 Git remote。

如果本地 remote refs 可能过期，请自行先执行 `git fetch`；插件故意不替你执行网络操作。

## Fork 与 push remote

打开 GitHub Compare 时，remote 解析基于 Git 实际配置，不再通过字符串猜测。

当前分支的 push target 按以下顺序解析：

1. `branch.<name>.pushRemote`
2. `remote.pushDefault`
3. `branch.<name>.remote`
4. `origin`
5. 其他已配置 remote

对于本地 Base 分支，插件会验证哪个 remote 实际拥有该分支后再构造 GitHub Compare URL；fork 场景下会在合适时优先 `upstream`。

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

每次 Copy/Open 前都会重新检查生成时的 snapshot。如果 HEAD 或 Base 已经变化，当前预览会进入 **stale/过期** 状态，Copy/Open 被禁用，必须重新生成。

“打开 GitHub PR”不会提交 PR。当前分支必须已经推送到插件识别出的 GitHub push remote。

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
| `safeCodexPr.includePullRequestTemplate` | `true` | 将 HEAD 中的小型 PR Template 作为不可信参考输入 |
| `safeCodexPr.extraInstructions` | 空 | 团队风格要求，不能覆盖安全/证据规则 |
| `safeCodexPr.timeoutSeconds` | `120` | 生成超时时间 |

仓库配置不能覆盖 `codexPath` 和 `model`。

## 可选仓库配置

仓库可提交 `.codex-pr.json`：

```json
{
  "language": "zh-CN",
  "baseBranch": "upstream/main",
  "titleMaxLength": 90,
  "maxBodyChars": 7000,
  "includePullRequestTemplate": true,
  "extraInstructions": "使用简洁工程语言；存在迁移影响时明确说明。"
}
```

插件**只使用 HEAD 中已经提交的版本**；working tree 中未提交的修改不会影响生成。符号链接形式的配置直接拒绝，未知字段直接拒绝。仓库配置不能选择 Codex executable 或 model。

PR Template 同样只从 HEAD 读取，并跳过符号链接。

## PR 正文结构

最终 Markdown 由插件本地生成：

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
```

正文末尾还会记录本地 Base...Head 比较范围。

## 大型 PR

diff 超过配置上限时**直接拒绝生成**，不会静默截断后假装已经理解整个 PR。确认 PR 规模合理后，可以主动提高 `safeCodexPr.maxDiffBytes`，但仍受硬上限约束。

## VSIX 安装

```bash
code --install-extension codex-pr-safe-1.0.1.vsix
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
