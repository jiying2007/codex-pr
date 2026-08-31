# Codex Change Safe

English | [简体中文](README.zh-CN.md)

**Codex Change Safe 5.1** is a developer-side GitHub Pull Request / GitLab Merge Request **delivery authorization and merge-readiness orchestrator**. It adds **zero model calls by default**: Review/Commit receipts, committed policy, Git evidence, native SCM policy and current remote state are combined deterministically.

Core flow:

```text
Review Receipt v4 → Commit Receipt v4 → manual commit/push
  → Policy → Preflight → Provenance → SCM Policy → Readiness → Authorization
  → GitHub PR / GitLab MR → native auto-merge / Merge Queue / Merge Train
```

Highlights: GitHub.com/GHES and GitLab.com/Self-Managed 14.6.1+; source/target remote topology for forks; automatic default-target discovery; committed `.codex-safe.json` policy that local settings can only tighten; provider-specific fail-closed merge-state machines; GitHub Ruleset/branch-protection merge policy snapshots; GitLab jobs, approvals and External Status Checks; managed-body integrity; title preservation; CODEOWNERS users/teams; environment Doctor; redirect-safe token handling; bounded GET retries; Change Receipt v1; VS Code Extension Host and real GitLab CE provider matrices.

See [README.zh-CN.md](README.zh-CN.md) for the full product contract and configuration examples.

## Development

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run ci
```

The release pipeline publishes a bundled `codex-change-safe-<version>.vsix`, SPDX SBOM, checksums and build provenance under the new Marketplace identity `jiying2007.codex-change-safe`.

## License

MIT
