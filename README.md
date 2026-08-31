# Codex Change Safe

English | [简体中文](README.zh-CN.md)

**Codex Change Safe** is a developer-side GitHub Pull Request / GitLab Merge Request **delivery orchestrator**. It replaces the retired PR-narrative generator with deterministic delivery preflight, cross-family provenance validation, PR/MR lifecycle operations, and merge-readiness gating.

The repository remains `jiying2007/codex-pr`, but v5 is a hard-cut product. The retired `safeCodexPr.*` surface, GitHub Compare workflow, copy/paste-first UX, and GitHub-only assumptions are not compatibility contracts.

## Workflow

```text
Codex Review Safe → Review Receipt v4
        ↓
Codex Commit Safe → Commit Receipt v4
        ↓
manual commit / push
        ↓
Codex Change Safe
  ├─ Delivery Preflight
  ├─ provenance validation
  ├─ deterministic Change Manifest
  ├─ GitHub PR / GitLab MR create/update
  ├─ CODEOWNERS reviewer routing
  ├─ CI / approval / conflict readiness
  ├─ Change Receipt v1
  └─ native auto-merge / GitHub merge queue
```

Change Safe does not duplicate the server-side webhook, durable review queue, finding publication, notification, or audit responsibilities of Codex Review Service.

## Token contract

v5 performs **zero additional model calls by default**. It composes committed Git metadata, SCM state, Review Receipt v4 and Commit Receipt v4 into managed PR/MR sections. It never re-sends the full change range to Codex merely to rewrite a narrative.

Managed sections are delimited by `<!-- codex-change-safe:* -->`, so updates preserve human-authored PR/MR prose.

## Platforms

- GitHub.com and GitHub Enterprise Server
- GitLab.com and GitLab Self-Managed
- GitLab Self-Managed minimum: 14.6.1
- GitHub native required-check discovery when branch protection is readable
- GitLab pipeline/job state and approval rules when the instance/license exposes them
- GitHub native auto-merge and merge queue; GitLab native auto-merge

## Safety

Remote writes always require explicit modal confirmation. Tokens are read only from environment variables. The configured API host is bound to the Git remote host to prevent credential exfiltration. Plain HTTP is refused by default; use HTTPS and `NODE_EXTRA_CA_CERTS` for internal CAs.

See [Architecture](docs/ARCHITECTURE.md), [Workflow](docs/WORKFLOW.md), [GitLab Self-Managed](docs/GITLAB_SELF_MANAGED.md), [Token Efficiency](docs/TOKEN_EFFICIENCY.md), [Migration](MIGRATION.md), and [Security](SECURITY.md).

## Development

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run ci
```

## License

MIT
