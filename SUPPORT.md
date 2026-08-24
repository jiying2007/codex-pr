# Support

Before opening an issue, run **Codex PR Safe: Check Codex Environment** and capture the PR Safe Output channel.

Include extension version, VS Code version, local/Remote SSH/Container/WSL context, OS, `git --version`, `codex --version`, selected Base, current branch, `git rev-list --count <base>..HEAD`, Workspace Trust state and the error code/message.

Do not attach credentials, private source code, proprietary full diffs, prompts or Codex authentication files.

Expected product boundaries are not bugs: PR Safe uses committed changes only, does not fetch/pull/push, does not create the remote PR automatically, and rejects stale output when HEAD/branch/Base changes.

For `ENOCHANGES`, always capture both `git status --short` and `git rev-list --count <base>..HEAD`.

中文：提 Issue 前先运行 **检查 Codex 环境** 并查看 Output。请提供插件/VS Code/Git/Codex/OS 版本、远端环境、Base、当前分支、`git rev-list --count <base>..HEAD`、Workspace Trust 与错误码/消息；不要上传凭据或私有源码。PR Safe 只处理已提交变更、不自动 fetch/push/提交远端 PR、仓库身份变化后拒绝 stale result，都是产品边界。遇到 `ENOCHANGES` 必须同时提供 `git status --short` 与 rev-list count。
