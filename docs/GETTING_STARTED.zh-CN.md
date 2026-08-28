# Codex PR Safe 快速开始

## 1. 安装环境

在 VS Code workspace Extension Host 所在环境安装 VS Code 1.90+、Git 和 OpenAI Codex CLI：

```bash
codex --version
```

使用官方 OpenAI 时，可继续在该环境登录 Codex：

```bash
codex login
```

Remote SSH、Dev Containers、Codespaces、WSL 必须在对应远端环境安装 Codex。插件运行在 workspace Extension Host 中，因此 Codex 可执行文件和 Provider 凭据都必须对该 Extension Host 可见。

## 2. 安装插件

从 VS Code Marketplace 安装 `jiying2007.codex-pr-safe`，或安装 GitHub Release 中 immutable VSIX。

## 3. 使用 OpenAI-compatible 中转站

Codex PR Safe 为保持 Safe Contract，会主动使用 `--ignore-user-config`，因此不会读取 `~/.codex/config.toml` 中的中转站/provider 配置。普通终端 Codex 可以继续使用该文件，但 PR Safe 必须显式配置 Provider。

在 VS Code User Settings JSON 中配置：

```json
{
  "safeCodexPr.providerMode": "openai-compatible",
  "safeCodexPr.providerBaseUrl": "https://relay.example.com/v1",
  "safeCodexPr.providerApiKeyEnv": "CODEX_RELAY_API_KEY",
  "safeCodexPr.model": "gpt-5.2"
}
```

要求：

- `providerBaseUrl` 必须是 HTTPS base URL，不要嵌入用户名、密码、query 或 fragment；
- `providerApiKeyEnv` 是环境变量名，不是 API Key 值；
- 中转站必须兼容 OpenAI Responses API（`/v1/responses`）以及 SSE/Structured Output，仅实现 `/v1/chat/completions` 不足以保证可用；
- compatible Provider 固定走 Responses HTTP/SSE，不走 WebSocket；
- 中转站使用自己的模型别名时，建议显式设置 `safeCodexPr.model`。

### 让 Key 对 Extension Host 可见

Linux/macOS：

```bash
export CODEX_RELAY_API_KEY="sk-xxxx"
code .
```

Windows PowerShell：

```powershell
$env:CODEX_RELAY_API_KEY="sk-xxxx"
code .
```

只在已经打开的 VS Code 集成终端里设置环境变量，不会反向更新正在运行的 Extension Host。请完全退出并从带有 Key 的环境重新启动 VS Code。

Remote SSH、WSL、Dev Containers、Codespaces 中，Key 必须位于远端 Extension Host 环境。

## 4. 检查环境

打开可信 Git workspace，运行 **Codex PR Safe: 检查 Codex 环境**。

新版检查会使用真实 PR Safe Runtime/Provider 完成一次最小结构化模型 round-trip，而不是只检查 CLI 是否存在。只有该检查成功，才表示凭据、中转站、Responses API、模型与 Structured Output 链路可用。

## 5. 准备 PR Range

PR Safe 只使用已 Commit 变更：

```bash
git status --short
git rev-list --count origin/main..HEAD
git log --oneline origin/main..HEAD
```

把 `origin/main` 替换成实际 Base。Count 为 0 表示当前没有已提交 PR Range。

## 6. 生成 PR

执行 **生成 PR**，在本地 Preview 中检查/编辑，再复制 title/body 或打开 GitHub Compare。最终远端提交必须人工完成。

## 常见问题

### 终端 Codex 能用，但 PR Safe 中转站失败

不要只检查 `~/.codex/config.toml`。确认 `safeCodexPr.providerMode=openai-compatible`、`providerBaseUrl`、`providerApiKeyEnv` 已配置，并确认 Key 对 Extension Host 可见，然后重新运行 **检查 Codex 环境**。

### 日志仍访问 `api.openai.com`

中转站模式不应回退官方 endpoint。重新检查 Provider Settings 和 Extension Host 环境，并重启 VS Code；不要仅通过增加 timeout 处理。

### 中转站只支持 Chat Completions

PR Safe 的 compatible Provider 要求 Responses API。中转站只支持 `/v1/chat/completions` 时，需要先补齐 Responses 兼容层。

### `ENOCHANGES`

执行：

```bash
git status --short
git rev-list --count <base>..HEAD
```

- Count `0` 且 `git status` 有修改：修改还没有 Commit，先 Commit；
- Count `0` 且工作区干净：当前分支没有领先 Base 的 Commit；
- Count > `0`：检查 Base 是否选对，并执行 `git diff --stat <base>...HEAD`。

PR Safe 刻意不把 working-tree-only 修改加入 PR。

### Base 选错

执行 **Select Base and Generate**，或配置 `safeCodexPr.baseBranch`。PR Safe 不自动 fetch。

### 找不到 Codex

在 workspace 相同 local/remote 环境执行 `codex --version`；必要时配置 `safeCodexPr.codexPath`。

### 当前分支未 Push

本地生成仍可工作；但要打开有效 GitHub Compare，需要用户自己先 Push。PR Safe 永远不会替你 Push。

### Preview stale

生成后如果 HEAD、当前分支或 Base 发生变化，Copy/Open 前必须重新生成。

## 升级

Marketplace 更新或安装新版 immutable VSIX，Reload VS Code 后先运行一次 **检查 Codex 环境** 再使用。
