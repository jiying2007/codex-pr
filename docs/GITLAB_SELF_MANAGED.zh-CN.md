# GitLab Self-Managed

Change Safe 将 GitLab Self-Managed 作为一等 Provider，不依赖 github.com。

最低兼容版本：**14.6.1**。实例版本通过 `/api/v4/version` 真实探测；低于下限或无法安全解析版本时 Preflight 阻断。

## 内网配置

```json
{
  "safeCodexChange.provider": "gitlab",
  "safeCodexChange.remote": "origin",
  "safeCodexChange.targetBranch": "main",
  "safeCodexChange.gitlabApiBaseUrl": "https://gitlab.company.local/api/v4"
}
```

```bash
export GITLAB_TOKEN='...'
export NODE_EXTRA_CA_CERTS=/etc/company-ca.pem
```

API host 必须与 Git remote host 相同。不要使用公网 relay 转发 GitLab Token。

## 版本能力

- Draft：统一使用 `Draft:` 标题前缀，覆盖旧 GitLab。
- Auto-Merge：GitLab 17.11+ 使用 `auto_merge=true`；旧 profile 使用 `merge_when_pipeline_succeeds=true`。
- CI：优先读取当前 MR head pipeline 的 jobs；无权限读取 jobs 时回退 pipeline 状态。
- Approval Rules：接口可用时读取 `/approval_state`；CE/权限不足时回退普通 approvals + 配置门槛。
