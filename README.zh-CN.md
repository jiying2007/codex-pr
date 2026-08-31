# Codex Change Safe

[English](README.md) | [简体中文](README.zh-CN.md)

在 VS Code 中根据**已提交的 Git 证据、Review/Commit provenance、仓库策略与 SCM 原生合并状态**完成 GitHub Pull Request / GitLab Merge Request 的交付授权与编排；Change 阶段默认新增模型调用为 **0**。

## 快速开始

适合在 source branch 已经完成 Commit 和 Push 后使用。Codex Change Safe 不修改源码，不执行 `git commit`、fetch、pull、rebase 或 push；它验证当前交付快照，并且只有在用户显式确认后才执行 PR/MR 远端操作。

环境要求：

- VS Code 1.90.0+
- Git
- 已信任 Git workspace
- GitHub 使用 `GITHUB_TOKEN`，GitLab 使用 `GITLAB_TOKEN`，并通过 Extension Host 环境变量提供
- 当仓库 Policy 要求 provenance 时，需要 Codex Review Safe / Codex Commit Safe

Remote SSH、Dev Containers、Codespaces、WSL 场景下，需要在 workspace Extension Host 所在环境提供 SCM Token。GitLab Self-Managed 或 GHES 只有在自动发现不足时才需要显式配置对应 API Endpoint。

### 第一次成功交付

1. 使用正常 Git/VS Code 流程 Commit 并 Push source branch。
2. 先运行一次 **Codex Change Safe: Check Environment / Doctor**。
3. 运行 **Codex Change Safe: Delivery Preflight**。
4. 处理所有 Git、provenance、policy 或 provider 阻断项。
5. 运行 **Codex Change Safe: Create / Update PR or MR**，并确认远端写操作。
6. 启用 Native Auto-Merge、GitHub Merge Queue 或 GitLab Merge Train 前，先运行 **Refresh Merge Readiness**。

详细交付流程与企业环境配置见 [工作流与授权](docs/WORKFLOW.zh-CN.md) 和 [GitLab Self-Managed](docs/GITLAB_SELF_MANAGED.zh-CN.md)。

## 核心保证

- Change 阶段默认模型调用为 `0`；title/body/risk/evidence 由 Git、Receipt 与 SCM state 确定性生成。
- 所有远端 mutation 都统一经过最新 Delivery Authorization Gate，并重新验证当前交付证据。
- `.codex-change-safe.json` 从 target branch committed policy 读取；本地设置只能加严，不能削弱 committed requirements。
- Safe Core/Review/Commit 继续使用独立的 `.codex-safe.json` Policy Schema v3；Change Safe 不重载、不重新解释这个文件。
- GitHub/GitLab 使用各自的 provider-specific merge-state classifier；未知状态一律进入 `WAITING`，不会隐式判定为 Ready。
- GitHub 原生策略同时覆盖 classic branch protection 与 active Rulesets；可用时保留 required-check app/integration identity。
- GitLab readiness 覆盖 pipeline/jobs、approvals 与 External Status Checks；Merge Train 按实例能力启用。
- source/target remote 独立，支持 GitHub fork 和同一 GitLab 实例内的跨项目 MR。
- Managed Sections 会验证 marker 完整性；重复、残缺或异常 marker 会阻断更新，不覆盖人工正文。
- 默认保留人工修改后的现有 PR/MR Title。
- CODEOWNERS user 与 GitHub team 不会静默丢失；GitLab group/team 可显式映射到 reviewer username。
- SCM Token 只来自环境变量；API host 与 Git remote host 绑定；禁止 redirect；仅只读 GET 请求进行有界重试。
- Doctor 与运行诊断默认脱敏，不记录 Token、源码、diff 或 PR/MR 正文。
- canonical JSON 与 fingerprint 共享能力只来自精确 commit-pinned 的 `codex-safe-core` submodule。

## Repository Policy

推荐把 Change Safe 交付门禁提交到 target branch 的 **`.codex-change-safe.json`**，使用 `schemaVersion: 1`：

```json
{
  "schemaVersion": 1,
  "change": {
    "provenancePolicy": "require-all",
    "blockOnReviewFindings": true,
    "requireCleanWorktree": true,
    "requirePushedHead": true,
    "requireFreshTarget": true,
    "requiredChecks": ["build", "unit-test"],
    "requiredApprovals": 1,
    "titlePolicy": "create-only"
  }
}
```

有效交付策略是 Provider 原生要求、committed Change Safe policy 与本地 tightening settings 的并集。本地配置不能减少 required checks、approvals、provenance requirements 或 safety booleans。

`.codex-change-safe.json` 刻意与 Safe Core 的 `.codex-safe.json` Policy Schema v3 分离，因此 Review Safe、Commit Safe、Change Safe 可以在同一仓库同时使用而不会发生 schema 冲突。5.1.0 实验性的 `.codex-safe.json.change` 形式在 5.1.1 中不再接受；需要显式迁移，不提供兼容 fallback。

## Family 工作流

```text
staged changes
    ↓
Codex Review Safe → Review Receipt v4
    ↓
Codex Commit Safe → Commit Receipt v4
    ↓
人工 git commit / push
    ↓
Codex Change Safe → Change Receipt v1
    ↓
GitHub PR / GitLab MR
    ↓
CI / Human Review / Codex Review Service / Merge Queue or Merge Train
```

Change Safe 可以在 advisory provenance 模式独立使用；仓库 Policy 也可以要求 Review 与 Commit evidence 完整后才能交付。它不复制 Codex Review Service 的 webhook、durable queue、Finding publication、notification 或服务端审计职责。

## Provider 支持

- GitHub.com 与 GitHub Enterprise Server（GHES）
- GitLab.com 与 GitLab Self-Managed 14.6.1+
- GitHub Native Auto-Merge 与 Merge Queue
- GitLab Native Auto-Merge 与 capability-aware Merge Train
- 自动发现 target repository default branch
- GitHub fork 与同实例 GitLab cross-project topology

永久 Provider Contract Matrix 会真实验证 GitLab CE 14.6.1、17.11.7、19.3.0；VS Code Extension Host 验证覆盖 Windows、macOS、Linux 与最低 VS Code 1.90.0。

## 安装、升级与验证

从 GitHub Release 安装 immutable VSIX。每个 Release 只构建一次，并附带 SPDX SBOM、SHA256SUMS 与 GitHub build-provenance attestation。见 [VERIFY_RELEASE.md](VERIFY_RELEASE.md) 与 [PUBLISHING.md](PUBLISHING.md)。

Marketplace 使用新身份 `jiying2007.codex-change-safe`；不会复用已退役的 `jiying2007.codex-pr-safe` 身份。

## 开发

```bash
git submodule update --init --recursive
npm ci --ignore-scripts --no-audit --no-fund
npm run ci
```

`npm run package` 会构建 bundled `dist/extension.js` 并生成 `codex-change-safe-<version>.vsix`。

## 支持与安全

- 使用/故障排查：[SUPPORT.md](SUPPORT.md)
- 安全/漏洞报告：[SECURITY.md](SECURITY.md)
- 发布：[PUBLISHING.md](PUBLISHING.md)

## Identity

- Publisher：`jiying2007`
- Extension ID：`jiying2007.codex-change-safe`
- Settings：`safeCodexChange.*`
- Committed delivery policy：`.codex-change-safe.json` schema v1

## License

MIT
