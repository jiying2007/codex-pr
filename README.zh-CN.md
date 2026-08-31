# Codex Change Safe

[English](README.md) | 简体中文

**Codex Change Safe 5.1** 是开发者侧 GitHub PR / GitLab MR **变更交付授权与 Merge Readiness 编排器**。它不重新把完整 diff 发给模型，默认新增模型调用为 **0**；它复用 Review Receipt v4 / Commit Receipt v4，并把 committed policy、Git snapshot、SCM 原生规则与实时远端状态组合成确定性授权结论。

## 产品位置

```text
Codex Review Safe  → Review Receipt v4
Codex Commit Safe  → Commit Receipt v4
人工 commit / push
        ↓
Codex Change Safe
  Policy → Preflight → Provenance → Native SCM Policy → Readiness → Authorization
        ↓
GitHub PR / GitLab MR
        ↓
CI / Human Review / Review Service / Merge Queue or Merge Train
```

Change Safe 不复制 `codex-review-service` 的 webhook、durable queue、Finding publication、IM notification 或服务端审计职责。

## 5.1 关键能力

- GitHub.com / GHES、GitLab.com / GitLab Self-Managed 14.6.1+。
- source / target remote 分离：支持 GitHub fork，并通过 GitLab `target_project_id` 支持同实例跨项目拓扑。
- target branch 为空时优先发现 remote HEAD / SCM default branch，不再硬编码 `main`。
- `.codex-safe.json` committed Change Policy；本地设置**只能加严，不能减弱** committed policy。
- 统一 Delivery Authorization Gate：Create/Update、Request Reviewers、Mark Ready、Auto-Merge、Merge Queue、Merge Train 都必须重新验证最新证据。
- GitHub Merge Policy Snapshot：classic branch protection + active Rulesets；required checks 支持 `context + integration/app identity`，并合并原生 approvals / CODEOWNERS / merge queue 等策略。
- GitLab provider-specific `detailed_merge_status` 状态机；未知新状态一律 `WAITING`，不再 fail-open。
- GitLab pipeline/job、Approval Rules、External Status Checks；Premium/Ultimate 可使用 Merge Train。
- Managed Sections marker 完整性检查；重复/残缺 marker 直接阻断更新。
- `titlePolicy=create-only|preserve|managed`，默认不会覆盖人工修改后的现有 PR/MR 标题。
- CODEOWNERS individual + GitHub team owner；GitLab team/group 可通过 `teamReviewerMap` 映射到用户名，未映射项明确提示而非静默丢弃。
- SCM Token 仅来自环境变量；API host 与 Git remote host 绑定；HTTP redirect 禁止；GET transient failure 有界重试。
- `Check Environment / Doctor` + redacted Output Channel，不记录 Token、源码、diff 或 PR/MR 正文。
- Change Receipt v1 保留稳定 snapshot fingerprint 与 remote-bound delivery fingerprint。

## Committed Change Policy

推荐把交付门禁提交到目标分支的 `.codex-safe.json`：

```json
{
  "schemaVersion": 4,
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

有效策略为：

```text
SCM native policy
        ∪
committed .codex-safe.json policy
        ∪
local tightening settings
```

本地配置不能减少 committed required checks、approvals、provenance 或 safety booleans。

## Merge Authorization

状态仍只有：`BLOCKED / WAITING / READY_TO_MERGE`。

- **Create / Update / Request Reviewers / Mark Ready**：要求最新 Preflight + provenance 不被阻断。
- **Native Auto-Merge**：允许等待明确可安全延迟的 CI/approval 状态；policy unknown、provenance unknown、head/target stale、未知危险状态一律拒绝。
- **GitHub Merge Queue / GitLab Merge Train**：只允许 `READY_TO_MERGE`。

GitLab `detailed_merge_status` 由 GitLab Provider 自己分类；只有明确 `mergeable` 才是 ready candidate，未来新增的未知状态默认 WAITING。

## Fork / 多 Remote

```json
{
  "safeCodexChange.sourceRemote": "origin",
  "safeCodexChange.targetRemote": "upstream",
  "safeCodexChange.targetBranch": ""
}
```

空 target branch 自动发现目标仓库默认分支。source/target 必须位于同一 GitHub/GitLab 实例，跨 SCM host fail closed。

## Token 效率

Change 层默认 **0 次模型调用**。title、summary、risk、review focus、rollback 与 evidence 都由 commit metadata、path signals、Receipt 和 SCM state 确定性生成。CI 永久门禁禁止 `runCodex` / `codex exec` 重新进入 Change domain。

## 验证与发布

- Unit / contract / manifest / Actions pin gate。
- Windows / macOS / Linux × Node 22.22.2 / 24.19.0。
- 真 VS Code Extension Host：latest + VS Code 1.90.0 minimum。
- GitLab CE provider matrix：14.6.1 / 17.11.7 / 19.3.0。
- GitHub Release：VSIX + SPDX SBOM + SHA256SUMS + build provenance attestation。
- Marketplace 使用新身份 `jiying2007.codex-change-safe`；旧 `codex-pr-safe` 仅保留历史/退役身份。

详细文档：

- [架构](docs/ARCHITECTURE.md)
- [工作流与授权](docs/WORKFLOW.zh-CN.md)
- [GitLab Self-Managed](docs/GITLAB_SELF_MANAGED.zh-CN.md)
- [Token 效率](docs/TOKEN_EFFICIENCY.zh-CN.md)
- [发布验证](VERIFY_RELEASE.md)
- [发布说明](PUBLISHING.md)
- [安全](SECURITY.md)

## 开发验证

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run ci
```

`npm run package` 会构建 bundled `dist/extension.js` 并生成 `codex-change-safe-<version>.vsix`。

## License

MIT
