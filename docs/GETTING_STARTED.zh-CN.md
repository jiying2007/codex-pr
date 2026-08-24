# Codex PR Safe 快速开始

## 1. 安装环境

在 VS Code workspace Extension Host 所在环境安装 VS Code 1.90+、Git 和 OpenAI Codex CLI，并完成登录：

```bash
codex --version
codex login
```

Remote SSH、Dev Containers、Codespaces、WSL 必须在对应远端环境安装 Codex。

## 2. 安装插件

从 VS Code Marketplace 安装 `jiying2007.codex-pr-safe`，或安装 GitHub Release 中 immutable VSIX。

## 3. 检查环境

打开可信 Git workspace，运行 **Codex PR Safe: 检查 Codex 环境**。

## 4. 准备 PR Range

PR Safe 只使用已 Commit 变更：

```bash
git status --short
git rev-list --count origin/main..HEAD
git log --oneline origin/main..HEAD
```

把 `origin/main` 替换成实际 Base。Count 为 0 表示当前没有已提交 PR Range。

## 5. 生成 PR

执行 **生成 PR**，在本地 Preview 中检查/编辑，再复制 title/body 或打开 GitHub Compare。最终远端提交必须人工完成。

## 常见问题

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
