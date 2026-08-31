# Codex Change Safe

[English](README.md) | 简体中文

**Codex Change Safe** 是开发者侧的 GitHub Pull Request / GitLab Merge Request **变更交付编排器**。它不再重新把完整 diff 发送给 Codex 生成一份 PR 文案，而是把已经完成的 Review / Commit provenance、Git 元数据与 SCM 原生状态组合成确定性的 Delivery Preflight、Change Manifest 和 Merge Readiness Gate。

> 仓库仍为 `jiying2007/codex-pr`，但 v5 是硬切的新产品。旧 Codex PR Safe 已退役；旧 `safeCodexPr.*` 设置、GitHub Compare URL、Copy/Open 主流程和 GitHub-only Provider 不属于 v5 兼容面。

## 它在工作流中的位置

```text
staged changes
    ↓
Codex Review Safe → Review Receipt v4
    ↓
Codex Commit Safe → Commit Receipt v4
    ↓
人工 commit / push
    ↓
Codex Change Safe
    ├─ Delivery Preflight
    ├─ Review / Commit provenance validation
    ├─ deterministic Change Manifest
    ├─ GitHub PR / GitLab MR create & update
    ├─ CODEOWNERS reviewer routing
    ├─ CI / approvals / conflicts / discussions
    ├─ Change Receipt v1
    └─ Ready-to-Merge / native auto-merge
    ↓
GitHub / GitLab
    ↓
Codex Review Service / CI / Human Review
```

`codex-review-service` 仍然是服务端 Review / publication / gate / audit；Change Safe 不复制它的 webhook、durable queue、Finding publication 或 IM notification 能力。

## 为什么比旧 PR Safe 有用

旧产品的主要链路是 `base...HEAD → Codex → PR title/body → Copy/Open`。v5 默认 **0 次新增模型调用**：

- title 从真实 commit subject 确定性构造；
- Summary / Impact / Risk / Verification / Reviewer Focus / Rollback / Evidence 使用 Git/SCM/Receipt 事实确定性生成；
- Review Receipt v4 和 Commit Receipt v4 通过各扩展公开 API 复用，不读取对方私有 `globalState`；
- 不重复把完整 diff 发送给模型，因此 Change 阶段的新增模型 Token 为 **0**；
- PR/MR 更新只替换 `<!-- codex-change-safe:* -->` Managed Sections，不覆盖开发者手写内容。

## 支持矩阵

| 能力 | GitHub | GitLab |
| --- | --- | --- |
| github.com / gitlab.com | ✅ | ✅ |
| GHES / Self-Managed | ✅ | ✅ |
| Create / Update | PR | MR |
| Draft / Ready | ✅ | ✅ |
| Labels | ✅ | ✅ |
| CODEOWNERS individual reviewers | ✅ | ✅ |
| CI status | Status + Check Runs | MR pipeline + job |
| Approval state | Reviews | Approvals + Approval Rules（可用时） |
| Conflicts / mergeability | ✅ | ✅ |
| Native auto-merge | ✅ | ✅ |
| Merge Queue | ✅ | 使用 GitLab 原生 auto-merge |
| Change Receipt v1 | ✅ | ✅ |

GitLab Self-Managed 支持下限为 **14.6.1**。17.11+ 使用 `auto_merge`；旧版本 capability profile 使用 `merge_when_pipeline_succeeds`。

## Delivery Preflight

创建或更新远端 PR/MR 前 fail closed 检查：

- named source branch，不允许 detached HEAD；
- `source != target`；
- 本地 target tracking ref 存在；
- merge-base 可证明；
- `base...HEAD` 存在提交；
- 默认要求 worktree/index clean；
- 默认要求远端 source SHA == 本地 HEAD；
- 默认要求本地 target tracking ref == 服务器 target SHA；
- GitLab 实例版本兼容；
- matching Review Receipt 中的 blocking verdict 默认阻断；
- provenance 可配置 `advisory / require-review / require-commit / require-all`。

Change Safe **不会隐式 fetch / pull / push**。如果 target ref stale，会明确要求开发者使用正常 Git 流程同步后重试。

## Merge Readiness

`Refresh Merge Readiness` 聚合：

- required checks；GitHub 优先读取 branch protection required status checks，权限不足时 fail closed 为 policy unknown；
- GitLab pipeline job 状态，无法读取 job 时回退 pipeline 状态；
- GitHub review approvals / GitLab approvals；
- GitLab approval rules（版本/许可可用时）；
- draft；
- merge conflict；
- GitLab blocking discussions；
- provider merge state。

最终只有：`BLOCKED / WAITING / READY_TO_MERGE`。

## 安全边界

远端写操作全部需要 VS Code modal confirmation：Create/Update、Request Reviewers、Mark Ready、Enable Auto-Merge、Enqueue Merge Queue。

SCM Token 只从环境变量读取，绝不写入设置。API host 必须与 Git remote host 绑定；`github.com` 只允许把 GitHub Token 发给 `api.github.com`。Self-Managed 推荐 HTTPS + `NODE_EXTRA_CA_CERTS`，明文 HTTP 默认拒绝。

## 配置示例

GitHub：

```json
{
  "safeCodexChange.provider": "github",
  "safeCodexChange.targetBranch": "main",
  "safeCodexChange.remote": "origin",
  "safeCodexChange.provenancePolicy": "require-all",
  "safeCodexChange.requiredApprovals": 1
}
```

```bash
export GITHUB_TOKEN='...'
```

GitLab Self-Managed：

```json
{
  "safeCodexChange.provider": "gitlab",
  "safeCodexChange.targetBranch": "main",
  "safeCodexChange.remote": "origin",
  "safeCodexChange.gitlabApiBaseUrl": "https://gitlab.company.local/api/v4",
  "safeCodexChange.requiredChecks": ["build", "unit-test"],
  "safeCodexChange.requiredApprovals": 2
}
```

```bash
export GITLAB_TOKEN='...'
export NODE_EXTRA_CA_CERTS=/etc/company-ca.pem
```

详细说明：

- [架构](docs/ARCHITECTURE.md)
- [工作流与门禁](docs/WORKFLOW.zh-CN.md)
- [GitLab Self-Managed](docs/GITLAB_SELF_MANAGED.zh-CN.md)
- [Token 效率](docs/TOKEN_EFFICIENCY.zh-CN.md)
- [v4 → v5 硬切迁移](MIGRATION.md)
- [安全](SECURITY.md)

## 开发验证

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run ci
```

当前 v5 核心没有运行时 npm 依赖，Node 单测覆盖 remote/provider 识别、preflight、Managed Sections、CODEOWNERS、provenance、Change Receipt、risk、readiness、GitLab capability 和 token host binding。

## License

MIT
