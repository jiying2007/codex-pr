# Security

## Trust model

Codex Change Safe runs only in trusted, local-file workspaces. It uses `execFile('git', args)` without a shell and performs read-only Git evidence collection. It never performs implicit fetch, pull, push, commit, rebase, or source modification.

## SCM credentials

- Tokens come from environment variables (`GITHUB_TOKEN`, `GITLAB_TOKEN` by default).
- Token values are never persisted in settings, receipts, PR/MR bodies, output, or logs.
- API URL userinfo is rejected.
- The API hostname must be bound to the Git remote hostname; GitHub.com is specially bound to `api.github.com`.
- Plain HTTP is denied unless `allowInsecureHttp=true` is explicitly configured. Prefer HTTPS + `NODE_EXTRA_CA_CERTS` for private CAs.

Use least-privilege tokens sufficient for PR/MR metadata, reviewer/label operations, checks/approvals, and the explicitly used merge operation.

## Remote mutations

Every user-triggered remote mutation requires a modal confirmation. Enabling auto-merge is refused when readiness is `BLOCKED`; GitHub merge-queue enqueue requires `READY_TO_MERGE`.

## Reporting

Do not include live credentials or private repository contents in a public issue. Use the repository's private security-reporting mechanism when available.
