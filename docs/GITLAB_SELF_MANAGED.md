# GitLab Self-Managed

Codex Change Safe 5.4 supports GitLab 14.6.1+ and validates the provider contract against real GitLab CE 14.6.1, 17.11.7 and 19.3.0.

## Discovery

With `safeCodexChange.provider=auto`, well-known cloud hosts are recognized immediately. Custom/self-managed hosts use a **credential-free same-host probe before any token is loaded**.

A common LAN topology is supported directly:

```text
Git remote: git@192.168.10.20:group/repo.git
GitLab Web/API: http://192.168.10.20
```

When machine-scoped `safeCodexChange.allowInsecureHttp=true` is explicitly enabled, Change Safe probes `https://192.168.10.20` first and then `http://192.168.10.20`; discovery requests never carry the SCM token. If both transports identify the same provider, HTTPS wins.

If GitLab's `/-/health` endpoint returns 401/403 because monitoring endpoints are IP-allowlisted and `safeCodexChange.provider=gitlab` is already explicit, Change Safe can use that restricted response as transport reachability evidence and derive `http://IP/api/v4`. If a reverse proxy hides the endpoint entirely, configure `safeCodexChange.gitlabApiBaseUrl` explicitly.

An HTTP Git remote such as `http://192.168.10.20/group/repo.git` is also supported after the same explicit HTTP opt-in.

Custom HTTPS ports and relative URL roots are supported. For example, a remote at `https://scm.example.local:8443/gitlab/group/repo.git` can use `https://scm.example.local:8443/gitlab/api/v4`. Explicit GitLab API bases must end with `/api/v4`.

If Git uses one hostname and the API uses another name for the same internal server, configure machine-scoped `safeCodexChange.trustedApiHostAliases`; aliases are never inferred from DNS automatically.

## TLS and HTTP

Prefer HTTPS. Private CA deployments should use `NODE_EXTRA_CA_CERTS=/path/to/company-ca.pem`.

Plain HTTP is rejected unless machine-scoped `safeCodexChange.allowInsecureHttp=true` is explicitly enabled, and redirects remain disabled. For IP literals, the plaintext shortcut is restricted to RFC1918/loopback/link-local/CGNAT-style internal addresses; a public IP is rejected even when HTTP opt-in is enabled. An HTTPS Git remote cannot downgrade its API credentials to HTTP.

When HTTP is used, Delivery Preflight and Doctor surface a plaintext warning: the GitLab PAT/PRIVATE-TOKEN and API payloads are not protected by TLS. This mode is intended only for an isolated, trusted LAN and is not treated as equivalent to HTTPS.

## Token

The token is read only from the environment variable named by `safeCodexChange.gitlabTokenEnv` (default `GITLAB_TOKEN`). The environment variable name is validated before use and token values are never logged or stored in settings. Remote writes remain blocked when the token is missing.

## Doctor

Run **Codex Change Safe: Check Environment / Doctor** before Delivery Preflight. Doctor does not require provider resolution to have succeeded; it reports remote parsing, provider discovery, API base, token presence, GitLab version, default branch, and distinct TLS/DNS/network/401/403 failures.

GitLab documents `/-/health` as a monitoring endpoint that can be protected by an IP allowlist. Doctor therefore reports a restricted probe as a policy/reachability condition rather than equating it with “not GitLab.”

## Provider behavior

- 17.11+ auto-merge uses `auto_merge`; older supported versions use `merge_when_pipeline_succeeds`.
- Merge readiness is fail-closed for unknown future merge states.
- Blocking manual jobs remain pending; `allow_failure` manual jobs do not block.
- Premium/Ultimate Merge Train remains bound to the current MR head SHA.
- GitLab CODEOWNERS uses root → `docs/` → `.gitlab/` discovery and section-aware matching. Owners that require runtime role/email resolution are surfaced as unresolved rather than guessed.
