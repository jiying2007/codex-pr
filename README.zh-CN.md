# Codex PR Safe

[English](README.md) | [简体中文](README.zh-CN.md)

在 VS Code 中使用本地 OpenAI Codex CLI，基于**已经提交的 Git 变更**安全生成结构化 Pull Request 标题和正文。

> **为什么叫 “Safe”？** Codex PR Safe 是 [Codex Commit Safe](https://github.com/jiying2007/codex-commit) 与 [Codex Review Safe](https://github.com/jiying2007/codex-review) 的 PR 配套扩展。它刻意缩小信任边界：只分析已提交 `base...HEAD`、仓库规则和 PR Template 固定读取 HEAD、使用 Structured Output、拒绝 stale result、限制 Codex 能力、不隐式执行 Git 网络操作，并且不会自动提交远端 PR。

## 主要能力

- VS Code Source Control 一键生成 PR 标题和正文
- **只分析已提交变更**（`merge-base...HEAD`）；staged / unstaged working tree 改动不会混入
- Fork-aware Base 选择和 GitHub Compare 支持
- PR 生成内容支持 **简体中文 / English**
- VS Code 命令、设置、进度、警告、预览操作和关键错误支持 **英文 / 简体中文**运行时本地化
- VS Code UI 语言与 PR 生成语言相互独立
- Codex Structured Output + 本地严格 Schema 校验 + 本地 Markdown 格式化
- Testing 状态确定性：没有可信执行证据时，Codex PR Safe 永远不会声称“测试已通过”
- 生成期间及每一次 Copy/Open 前校验 HEAD + Base OID snapshot
- `.codex-pr.json` 和 PR Template 固定读取 HEAD；未提交修改和仓库符号链接不能改变请求
- CI 覆盖 Windows `.exe/.cmd/.bat`、Linux、macOS
- 永远不会自动 `fetch`、`pull`、`push`、创建 PR、更新 PR 或提交远端 PR

## 中英文支持

VS Code 界面语言通过标准 runtime localization 自动跟随编辑器 locale：

- English VS Code → English 命令/消息/预览文案
- 简体中文 VS Code → 简体中文命令/消息/预览文案

PR 生成语言单独由以下配置控制：

```json
{
  "safeCodexPr.language": "zh-CN"
}
```

或：

```json
{
  "safeCodexPr.language": "en"
}
```

因此中文 UI 可以生成英文 PR，英文 UI 也可以生成中文 PR。

## 工作流

```text
Code
  ↓
Codex Review Safe
  ↓
Codex Commit Safe
  ↓
已提交的功能分支
  ↓
Codex PR Safe
  ↓
本地可编辑预览
  ↓
GitHub Compare
  ↓
人工最终提交
```

## 环境要求

- VS Code 1.90.0+
- Git
- VS Code 环境中可执行的 OpenAI Codex CLI
- 已信任、基于本地文件系统的 Git 工作区

先确认：

```bash
codex --version
codex --help
codex exec --help
```

## 安装

从 GitHub Release 下载 VSIX 后安装：

```bash
code --install-extension codex-pr-safe-1.0.2.vsix
```

或在 VS Code 中：

```text
Extensions → ... → Install from VSIX...
```

安装后执行：

```text
Ctrl+Shift+P → Codex PR Safe: 检查环境
```

## 使用方法

1. 提交本次 PR 应包含的代码变更。
2. 确认本地 Base ref 足够新；需要时自行执行 `git fetch`。
3. 打开 **Source Control**。
4. 执行 **Codex PR Safe: 生成 PR**，或点击 Source Control 工具栏图标。
5. 在本地预览中检查并编辑标题和正文。
6. 复制结果或打开 GitHub Compare 页面。
7. 最终人工确认后再提交远端 Pull Request。

Source Control 中 **Generate PR** 使用 `git-pull-request` 图标，**Regenerate PR** 使用 `redo`，避免与 Git 原生 Refresh 图标冲突。

## Base 与 Fork 逻辑

Codex PR Safe 不会联网查询默认分支，Base 选择刻意保持保守：

1. 有效的 `safeCodexPr.baseBranch` / 已提交 `.codex-pr.json` 明确配置优先。
2. 检测到典型 fork 拓扑（`origin` 是 fork，`upstream` 是另一个 GitHub 仓库）时，优先本地 `upstream/HEAD`。
3. 其他情况优先本地 `origin/HEAD`，然后 `upstream/HEAD`。
4. 再考虑 `origin/main`、`upstream/main`、`main`、`master`、`develop`、`dev` 等常见 refs。
5. 没有高置信度 Base 时不猜，直接要求用户选择。

分支名包含 `/` 不代表它一定是 remote。例如 `release/1.0` 会保持为完整本地分支，除非 `release` 本身确实是已配置的 Git remote。

当前分支的 GitHub push target 按以下顺序解析：

1. `branch.<name>.pushRemote`
2. `remote.pushDefault`
3. `branch.<name>.remote`
4. `origin`
5. 其他已配置 remote

对于本地 Base，插件会验证哪个 remote 实际拥有该分支后再构造 GitHub Compare URL。

## 预览与 stale result 防护

生成后提供可编辑预览：

- PR 标题
- PR 正文
- Base...Head 比较范围
- dirty working tree 警告
- 复制标题 / 复制正文 / 复制全部
- 重新生成
- 更换 Base
- 打开 GitHub PR

每一次 Copy/Open 前都会重新校验 `HEAD OID + Base OID + Base ref`。如果结果已过期，Copy/Open 会被禁用，必须重新生成。

“打开 GitHub PR”不会直接提交 PR。插件只复制当前可编辑标题/正文并打开 GitHub Compare 页面，最终远端写操作始终由用户完成。

## 安全模型

Codex PR Safe 采用偏保守的边界：

1. **只支持受信任工作区**：Restricted Mode 和虚拟工作区不支持。
2. **只分析已提交范围**：模型输入来自已提交 `base...HEAD` 历史和 diff。
3. **仓库控制输入也只读 HEAD**：`.codex-pr.json` 和 PR Template 从精确 HEAD Git object 读取，仓库符号链接不会被跟随。
4. **VS Code Settings 仅允许 User/Application scope**：所有 `safeCodexPr.*` 设置均为 application scope；仓库定制只能通过已提交 `.codex-pr.json` 生效。
5. **不隐式执行 Git 网络操作**：不会自动 `fetch` / `pull` / `push`。
6. **Codex 只读运行**：空临时目录、read-only sandbox、禁止审批、关闭 Web Search，并关闭不需要的 execution/app/agent 能力。
7. **CLI 能力预检**：生成前检查 `codex --help` / `codex exec --help` 是否具备插件要求的安全和结构化输出能力。
8. **Prompt Injection 边界**：仓库派生文本全部视为不可信数据，不能覆盖安全/证据规则。
9. **Structured Output**：封闭 JSON Schema、本地验证、Summary/Changes 不能为空，中/高风险或 Breaking Change 必须给出具体风险。
10. **Testing 状态确定性**：模型不能输出测试执行成功状态；Testing 区域由插件本地固定标记“未验证”。
11. **结果过期保护**：收集、生成、Copy、Open 全链路校验 snapshot。
12. **不记录敏感持久日志**：源码 diff、Commit 内容、生成 PR 文本、原始 Codex stderr 和绝对仓库路径不会写入持久 Output Channel。

组织管理的 Codex Policy 仍可能生效，插件不会绕过它。

完整安全边界和发布供应链说明见 [SECURITY.md](SECURITY.md)。

## 配置

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `safeCodexPr.codexPath` | `codex` | 本地 Codex CLI 路径，仅 User/Application 可配置 |
| `safeCodexPr.model` | 空 | 可选模型覆盖，仅 User/Application 可配置 |
| `safeCodexPr.language` | `zh-CN` | PR 生成语言：`zh-CN` / `en` |
| `safeCodexPr.baseBranch` | 空 | 可选默认 Base，例如 `upstream/main` |
| `safeCodexPr.maxDiffBytes` | `524288` | 发送给 Codex 的文本 diff 最大字节数 |
| `safeCodexPr.maxCommitBytes` | `65536` | Commit 列表最大上下文字节数 |
| `safeCodexPr.titleMaxLength` | `100` | PR 标题建议最大长度 |
| `safeCodexPr.maxBodyChars` | `8000` | 本地格式化 PR 正文最大长度 |
| `safeCodexPr.includePullRequestTemplate` | `true` | 将 HEAD 中的小型 PR Template 作为不可信参考输入 |
| `safeCodexPr.extraInstructions` | 空 | 团队风格要求，不能覆盖安全规则 |
| `safeCodexPr.timeoutSeconds` | `120` | Codex 生成超时时间 |

所有 VS Code 设置均为 application scope，Workspace / Folder Settings 不能改变 PR policy。

## 项目配置

仓库可以提交 `.codex-pr.json`：

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

插件**只使用 HEAD 中已经提交的版本**。working tree 未提交修改不会生效；符号链接形式配置直接拒绝；未知字段直接拒绝；仓库配置不能选择 Codex executable 或 model。

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

diff 超过配置上限时**直接拒绝生成**，不会静默截断后假装已经理解整个 PR。只有确认 PR 规模合理后才应主动提高 `safeCodexPr.maxDiffBytes`。

## Extension Identity

- Repository：`codex-pr`
- Extension name：`codex-pr-safe`
- Display name：**Codex PR Safe**
- Publisher / VSIX ID：`jiying2007.codex-pr-safe`
- Command / Settings namespace：`safeCodexPr.*`
- Repository policy：`.codex-pr.json`
- 配套扩展：[Codex Commit Safe](https://github.com/jiying2007/codex-commit)、[Codex Review Safe](https://github.com/jiying2007/codex-review)
- Marketplace 状态：**尚未发布**；当前正式分发渠道为 GitHub Releases

## 开发与验证

```bash
npm run verify:lock
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run test:integration
npm run package
```

CI 会验证 manifest/runtime 双语目录一致性、runtime source-key coverage、Linux/Windows/macOS 最新 VS Code Extension Host、VS Code `1.90.0` 最低兼容、简体中文真实 smoke、官方 VSIX 内容和 SHA-256。

发布流程详见 [PUBLISHING.md](PUBLISHING.md)。

## License

见 [LICENSE](LICENSE)。
