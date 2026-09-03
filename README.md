# Codex Change Safe

[English](README.md) | [简体中文](README.zh-CN.md)

A VS Code extension that authorizes and orchestrates **GitHub Pull Request / GitLab Merge Request delivery** from committed Git evidence, Review/Commit provenance, repository policy and provider-native merge state — with **zero model calls by default**.

## Start here

Use this product after the source branch has been committed and pushed. Codex Change Safe does not edit source, run `git commit`, fetch, pull, rebase or push; it validates the delivery snapshot and performs only explicitly confirmed PR/MR operations.

Requirements:

- VS Code 1.90.0+
- Git
- a trusted Git workspace
- `GITHUB_TOKEN` for GitHub or `GITLAB_TOKEN` for GitLab in the Extension Host environment
- Codex Review Safe / Codex Commit Safe when repository policy requires their provenance

For Remote SSH, Dev Containers, Codespaces or WSL, provide the SCM token where the workspace Extension Host runs. For GitLab Self-Managed or GHES, configure the matching API endpoint only when automatic discovery is insufficient. For an isolated HTTP + private-IP GitLab, set machine-scoped `safeCodexChange.allowInsecureHttp=true`; SSH/IP remotes then probe HTTPS first and HTTP second without credentials. Delivery Preflight still warns that the PAT/API payloads are plaintext on the LAN.

### First successful delivery

1. Commit and push the source branch with normal Git/VS Code controls.
2. Run **Codex Change Safe: Check Environment / Doctor** once.
3. Run **Codex Change Safe: Delivery Preflight**.
4. Resolve blocked Git, provenance, policy or provider conditions.
5. Run **Codex Change Safe: Create / Update PR or MR** and confirm the remote write.
6. Use **Refresh Merge Readiness** before native auto-merge, GitHub Merge Queue or GitLab Merge Train.

See [Workflow](docs/WORKFLOW.md) and [GitLab Self-Managed](docs/GITLAB_SELF_MANAGED.md).

## What it guarantees

- Change-stage model calls are `0` by default; title/body/risk/evidence are deterministic from Git, receipts and SCM state.
- Every remote mutation revalidates fresh delivery evidence through one Delivery Authorization Gate.
- The only repository policy is committed `.codex-safe.json` **Policy Schema v4** from Safe Core 4.13.1.
- Change Safe consumes Core parsing, closed validation and policy fingerprinting; it does not own a parallel policy schema.
- Local Change settings can only tighten committed `change` rules; provider-native requirements are unioned and cannot be weakened locally.
- GitHub/GitLab merge states are provider-specific and fail closed; unknown states become `WAITING`.
- GitHub native policy combines classic branch protection and active Rulesets, including required-check app/integration identity where available.
- GitLab readiness includes pipeline/jobs, approvals and External Status Checks; Merge Train is capability-aware.
- Source/target remotes are independent, supporting GitHub forks and same-instance GitLab cross-project MRs.
- Managed body markers are integrity checked; malformed/duplicate sections block instead of rewriting human content.
- Existing human PR/MR titles are preserved by default.
- CODEOWNERS users and GitHub teams are retained; GitLab groups/teams can be explicitly mapped to reviewer usernames.
- SCM tokens come only from environment variables; API hosts are bound to Git remote hosts, redirects are rejected and only read-only GETs receive bounded retries.
- Doctor/diagnostics are redacted and never log tokens, source, diffs or PR/MR bodies.
- Shared policy, canonical JSON and fingerprint primitives come only from exact-pinned Safe Core.

## Repository policy

Use the Family-wide committed `.codex-safe.json` with `schemaVersion: 4`:

```json
{
  "$schema": "https://raw.githubusercontent.com/jiying2007/codex-safe-core/479e4b33356457a90617aea7bbba5ee25b65b2c8/codex-safe.schema.json",
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

Policy Schema v4 is a hard cut. Schema v3 and parallel `.codex-change-safe.json` files are not compatibility surfaces. Review, Commit, Change and Review Service consume their own sections through the same Core validator and committed policy fingerprint.

## Family workflow

```text
staged changes
    ↓
Codex Review Safe → Review Receipt v5
    ↓
Codex Commit Safe → Commit Receipt v4
    ↓
manual git commit / push
    ↓
Codex Change Safe → Change Receipt v1
    ↓
GitHub PR / GitLab MR
    ↓
CI / Human Review / Codex Review Service / Merge Queue or Merge Train
```

**Codex PR Safe is retired** as the former model-generated PR-description identity. Change Safe is a distinct deterministic successor delivery product; it does not restore the retired narrative generator.

## Provider support

- GitHub.com and GitHub Enterprise Server (GHES)
- GitLab.com and GitLab Self-Managed 14.6.1+
- GitHub native auto-merge and Merge Queue
- GitLab native auto-merge and capability-aware Merge Train
- automatic target default-branch discovery
- GitHub fork and same-instance GitLab cross-project topology

The provider contract matrix exercises GitLab CE 14.6.1, 17.11.7 and 19.3.0. Extension Host validation covers Windows, macOS, Linux and VS Code 1.90.0 minimum.

## Install, upgrade and verify

Install the immutable VSIX from GitHub Release. Each release includes SPDX SBOM, SHA256SUMS and GitHub build-provenance attestation. See [VERIFY_RELEASE.md](VERIFY_RELEASE.md) and [PUBLISHING.md](PUBLISHING.md).

Marketplace publication uses `jiying2007.codex-change-safe`; the retired `jiying2007.codex-pr-safe` identity is not reused.

## Development

```bash
git submodule update --init --recursive
npm ci --ignore-scripts --no-audit --no-fund
npm run ci
```

## Support and security

- Usage/troubleshooting: [SUPPORT.md](SUPPORT.md)
- Security/reporting: [SECURITY.md](SECURITY.md)
- Publishing: [PUBLISHING.md](PUBLISHING.md)

## Identity

- Publisher: `jiying2007`
- Extension ID: `jiying2007.codex-change-safe`
- Settings: `safeCodexChange.*`
- Safe Core: `4.13.1` exact pin `479e4b33356457a90617aea7bbba5ee25b65b2c8`
- Repository Policy: `.codex-safe.json` / Policy Schema v4

## License

MIT

## Runtime/Provider Contract v3 family alignment

Codex Change Safe 5.4.4 pins Core 4.13.1 and records Runtime/Provider Contract v3 consumption for Family compatibility. Change Safe still performs zero model calls by default and therefore does not expose model relay credentials or an auth.json setting of its own; Review, Commit, Diagnose and Review Service own those model-runtime controls. Change Safe's existing `allowInsecureHttp` remains scoped only to explicitly trusted GitHub/GitLab SCM APIs.
