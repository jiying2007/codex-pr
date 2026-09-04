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

Remote SSH、Dev Containers、Codespaces、WSL 场景下，需要在 workspace Extension Host 所在环境提供 SCM Token。GitLab Self-Managed 或 GHES 只有在自动发现不足时才需要显式配置对应 API Endpoint。对于隔离可信的 HTTP + 私有 IP GitLab，在 machine scope 设置 `safeCodexChange.allowInsecureHttp=true`；SSH/IP remote 会无凭据先探测 HTTPS、再探测 HTTP，Delivery Preflight 仍会明确提示 PAT/API payload 在局域网上是明文链路。

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
- 仓库策略唯一入口是 Safe Core 4.16.0 的 committed `.codex-safe.json` **Policy Schema v4**。
- Change Safe 直接消费 Core 的 parser、闭合字段/类型校验与 Policy fingerprint，不维护第二套 Repository Policy Schema。
- 本地 Change settings 只能加严 committed `change` rules；Provider 原生要求与之取并集，本地不能削弱。
- GitHub/GitLab 使用各自的 provider-specific merge-state classifier；未知状态一律进入 `WAITING`。
- GitHub 原生策略同时覆盖 classic branch protection 与 active Rulesets；可用时保留 required-check app/integration identity。
- GitLab readiness 覆盖 pipeline/jobs、approvals 与 External Status Checks；Merge Train 按实例能力启用。
- source/target remote 独立，支持 GitHub fork 和同一 GitLab 实例内的跨项目 MR。
- Managed Sections 验证 marker 完整性；重复、残缺或异常 marker 会阻断更新，不覆盖人工正文。
- 默认保留人工修改后的现有 PR/MR Title。
- CODEOWNERS user 与 GitHub team 不会静默丢失；GitLab group/team 可显式映射到 reviewer username。
- SCM Token 只来自环境变量；API host 与 Git remote host 绑定；禁止 redirect；仅只读 GET 请求进行有界重试。
- Doctor 与运行诊断默认脱敏，不记录 Token、源码、diff 或 PR/MR 正文。
- Policy、canonical JSON 与 fingerprint 共享能力只来自精确 commit-pinned Safe Core。

## Repository Policy

产品族统一使用 target branch 中 committed **`.codex-safe.json`**，必须使用 `schemaVersion: 4`：

```json
{
  "$schema": "https://raw.githubusercontent.com/jiying2007/codex-safe-core/786e3a3fc896e0e623af6fe63dbf814ddd09bad8/codex-safe.schema.json",
  "schemaVersion": 4,
  "review": {},
  "commit": {},
  "change": {
    "provenancePolicy": "require-all",
    "blockOnReviewFindings": true,
    "requireCleanWorktree": true,
    "requirePushedHead": true,
    "requireFreshTarget": true,
    "requiredChecks": ["build", "unit-test"],
    "requiredApprovals": 1,
    "titlePolicy": "create-only",
    "managedSections": true
  }
}
```

Policy Schema v4 是硬切。Schema v3 和 `.codex-change-safe.json` 都不作为兼容表面。Review、Commit、Change、Review Service 统一通过 Core validator 读取各自 section，并共享同一个 committed Policy fingerprint。

## Family 工作流

```text
staged changes
    ↓
Codex Review Safe → Review Receipt v5
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

**Codex PR Safe 已退役**，只指旧的模型生成 PR 描述身份。Codex Change Safe 是独立的确定性交付后继产品，不恢复旧 Narrative Generator。

## Provider 支持

- GitHub.com 与 GitHub Enterprise Server（GHES）
- GitLab.com 与 GitLab Self-Managed 14.6.1+
- GitHub Native Auto-Merge 与 Merge Queue
- GitLab Native Auto-Merge 与 capability-aware Merge Train
- 自动发现 target repository default branch
- GitHub fork 与同实例 GitLab cross-project topology

Provider Contract Matrix 真实验证 GitLab CE 14.6.1、17.11.7、19.3.0；VS Code Extension Host 验证覆盖 Windows、macOS、Linux 与最低 VS Code 1.90.0。

## 安装、升级与验证

从 GitHub Release 安装 immutable VSIX。每个 Release 只构建一次，并附带 SPDX SBOM、SHA256SUMS 与 GitHub build-provenance attestation。见 [VERIFY_RELEASE.md](VERIFY_RELEASE.md) 与 [PUBLISHING.md](PUBLISHING.md)。

Marketplace 使用新身份 `jiying2007.codex-change-safe`；不会复用已退役的 `jiying2007.codex-pr-safe` 身份。当前阶段 Marketplace 仅手工发布；immutable GitHub Release 仍是 Family 必需的分发权威。

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
- Extension ID：`jiying2007.codex-change-safe`
- Settings：`safeCodexChange.*`
- Safe Core：`4.16.0` 精确 pin `786e3a3fc896e0e623af6fe63dbf814ddd09bad8`
- Repository Policy：`.codex-safe.json` / Policy Schema v4

## License

MIT

## Runtime/Provider Contract v3 产品族对齐

Codex Change Safe 5.4.9 固定到 Core 4.16.0，并在 Product Contract 中记录 Runtime/Provider Contract v3 消费关系。Change Safe 默认模型调用仍为 0，因此不会额外暴露模型中转站凭据或 auth.json 设置；模型 Runtime 配置由 Review、Commit、Diagnose 与 Review Service 使用。Change Safe 现有 `allowInsecureHttp` 仍只服务于显式信任的 GitHub/GitLab SCM API。
