# GitLab Self-Managed

Codex Change Safe 5.4 支持 GitLab 14.6.1+，并继续通过真实 GitLab CE 14.6.1 / 17.11.7 / 19.3.0 Provider contract 矩阵。

## 自动发现

`safeCodexChange.provider=auto` 会直接识别公有云域名；遇到局域网/自建 host 时，在读取 Token 之前进行**同主机、无凭据探测**。

对于常见的局域网 GitLab：

```text
Git remote: git@192.168.10.20:group/repo.git
GitLab Web/API: http://192.168.10.20
```

只要 machine scope 显式设置 `safeCodexChange.allowInsecureHttp=true`，Change Safe 会先探测 `https://192.168.10.20`，不可用后再探测 `http://192.168.10.20`；任何探测都不会携带 Token。如果 HTTPS 和 HTTP 同时识别为同一 Provider，优先 HTTPS。

如果 GitLab 的 `/-/health` 被 monitoring IP allowlist 返回 401/403，而你已经显式设置 `safeCodexChange.provider=gitlab`，Change Safe 可以使用该受限响应确认 transport 可达，并自动得到 `http://IP/api/v4`；如果代理直接隐藏该 endpoint，则显式配置 `safeCodexChange.gitlabApiBaseUrl`。

HTTP Git remote 本身也支持，例如 `http://192.168.10.20/group/repo.git`，但同样必须显式打开 `allowInsecureHttp`。

支持自定义 HTTPS 端口和 relative URL root，例如 Remote 为 `https://scm.example.local:8443/gitlab/group/repo.git` 时，API 可配置为 `https://scm.example.local:8443/gitlab/api/v4`。显式 GitLab API Base 必须以 `/api/v4` 结尾。

如果 Git Remote 使用 IP、API 使用 DNS 名，但两者确实是同一台可信 GitLab，可在 machine scope 配置 `safeCodexChange.trustedApiHostAliases`。Change Safe 不会通过 DNS 自动猜别名，避免把 Token 发往未经确认的主机。

## TLS / HTTP

优先使用 HTTPS。公司私有 CA 推荐设置 `NODE_EXTRA_CA_CERTS=/path/to/company-ca.pem`。

HTTP 默认拒绝，只有 machine scope 明确设置 `safeCodexChange.allowInsecureHttp=true` 才允许；Redirect 始终禁用。对 IP literal，明文 HTTP 快捷路径只允许 RFC1918/loopback/link-local/CGNAT 等内部地址，公开 IP 即使打开 `allowInsecureHttp` 也会被拒绝。HTTPS Git remote 不允许把 API 降级到 HTTP。

使用 HTTP 时 Delivery Preflight 和 Doctor 会明确显示 plaintext warning：GitLab PAT/PRIVATE-TOKEN 与 API payload 在链路上没有 TLS 保护。该模式适合隔离、可信的公司局域网，不应视为和 HTTPS 等价。

## Token

Token 只从 `safeCodexChange.gitlabTokenEnv` 指定的环境变量读取，默认 `GITLAB_TOKEN`。环境变量名本身也会校验，Token 值不会进入日志或 VS Code Settings；缺少 Token 时远程写操作保持 BLOCKED。

## Doctor

优先执行 **Codex Change Safe: Check Environment / Doctor**。Doctor 不依赖“Provider 已经识别成功”，可以分层显示 Remote、Provider 探测、API Base、Token 是否存在、GitLab 版本、默认分支，以及 TLS / DNS / 网络 / 401 / 403 的具体失败原因。

`/-/health` 属于 GitLab monitoring endpoint，可能受 IP allowlist 保护；Doctor 会把这种情况标为“探测受策略限制”，而不是直接判定“不是 GitLab”。

## GitLab 行为

- GitLab 17.11+ Auto Merge 使用 `auto_merge`，旧版支持区间继续使用 `merge_when_pipeline_succeeds`。
- 未知 merge state 一律 fail-closed。
- Blocking manual job 保持 pending；`allow_failure` manual 不阻断。
- Premium/Ultimate Merge Train 继续绑定当前 MR HEAD SHA。
- CODEOWNERS 按 GitLab 的 root → `docs/` → `.gitlab/` 顺序搜索，并按 section 独立匹配；需要运行时角色/邮箱解析的 owner 明确标记 unresolved，不再误当用户名。
