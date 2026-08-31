# Codex Change Safe

[English](README.md) | [简体中文](README.zh-CN.md)

A VS Code extension that authorizes and orchestrates **GitHub Pull Request / GitLab Merge Request delivery** from committed Git evidence, Review/Commit provenance, repository policy and provider-native merge state — with **zero model calls by default**.

## Start here

Use this product after the source branch has been committed and pushed. Codex Change Safe does not edit source, run `git commit`, fetch, pull, rebase or push; it validates the delivery snapshot and performs only explicitly confirmed PR/MR operations.

Requirements:

- VS Code 1.90.0+
- Git
- a trusted Git workspace
- `GITHUB_TOKEN` for GitHub or `GITLAB_TOKEN` for GitLab, provided through the Extension Host environment
- Codex Review Safe / Codex Commit Safe when repository policy requires their provenance

For Remote SSH, Dev Containers, Codespaces or WSL, provide the SCM token in the environment where the workspace Extension Host runs. For GitLab Self-Managed or GHES, configure the matching API endpoint only when automatic discovery is not sufficient.

### First successful delivery

1. Commit and push the source branch with normal Git/VS Code controls.
2. Run **Codex Change Safe: Check Environment / Doctor** once.
3. Run **Codex Change Safe: Delivery Preflight**.
4. Resolve any blocked Git, provenance, policy or provider condition.
5. Run **Codex Change Safe: Create / Update PR or MR** and confirm the remote write.
6. Use **Refresh Merge Readiness** before enabling native auto-merge, GitHub Merge Queue or GitLab Merge Train.

See [Workflow](docs/WORKFLOW.md) and [GitLab Self-Managed](docs/GITLAB_SELF_MANAGED.md) for detailed delivery and enterprise configuration.

## What it guarantees

- Change-stage model calls are `0` by default; title/body/risk/evidence are generated deterministically from Git, receipts and SCM state.
- Every remote mutation revalidates fresh delivery evidence through the unified Delivery Authorization Gate.
- `.codex-safe.json` is read from committed target-branch policy; local settings can tighten but never weaken committed requirements.
- GitHub and GitLab merge states are provider-specific and fail closed; unknown states become `WAITING`, never implicit readiness.
- GitHub native policy combines classic branch protection and active Rulesets, including required-check app/integration identity where available.
- GitLab readiness includes pipeline/jobs, approvals and External Status Checks; Merge Train is capability-aware.
- Source/target remotes are independent, supporting GitHub forks and same-instance GitLab cross-project merge requests.
- Managed body markers are integrity checked; malformed or duplicate managed sections block updates instead of rewriting human content.
- Existing human PR/MR titles are preserved by default.
- CODEOWNERS users and GitHub teams are retained; GitLab groups/teams can be mapped explicitly to reviewer usernames.
- SCM tokens come only from environment variables; API hosts are bound to Git remote hosts, redirects are rejected, and only read-only GET requests receive bounded retries.
- Doctor and operational diagnostics are redacted and do not log tokens, source, diffs or PR/MR bodies.
- Shared canonical JSON and fingerprint primitives come only from the exact commit-pinned `codex-safe-core` submodule.

## Repository policy

Commit delivery policy in the target branch's `.codex-safe.json` with `schemaVersion: 4`:

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

Effective delivery policy is the union of provider-native requirements, committed repository policy and local tightening settings. Local configuration cannot remove required checks, approvals, provenance requirements or safety booleans.

## Family workflow

```text
staged changes
    ↓
Codex Review Safe → Review Receipt v4
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

Change Safe can operate with advisory provenance, but repository policy can require complete Review and Commit evidence before delivery. It does not duplicate Codex Review Service webhook, durable queue, Finding publication, notification or server-side audit responsibilities.

## Provider support

- GitHub.com and GitHub Enterprise Server (GHES)
- GitLab.com and GitLab Self-Managed 14.6.1+
- GitHub native auto-merge and Merge Queue
- GitLab native auto-merge and capability-aware Merge Train
- automatic target default-branch discovery
- GitHub fork and same-instance GitLab cross-project topology

The permanent provider contract matrix exercises GitLab CE 14.6.1, 17.11.7 and 19.3.0. VS Code Extension Host validation covers Windows, macOS, Linux and the VS Code 1.90.0 minimum.

## Install, upgrade and verify

Install the immutable VSIX from the GitHub Release. Each release is built once and includes an SPDX SBOM, SHA256SUMS and GitHub build-provenance attestation. See [VERIFY_RELEASE.md](VERIFY_RELEASE.md) and [PUBLISHING.md](PUBLISHING.md).

Marketplace publication uses the new identity `jiying2007.codex-change-safe`; the retired `jiying2007.codex-pr-safe` identity is not reused.

## Development

```bash
git submodule update --init --recursive
npm ci --ignore-scripts --no-audit --no-fund
npm run ci
```

`npm run package` builds bundled `dist/extension.js` and produces `codex-change-safe-<version>.vsix`.

## Support and security

- Usage/troubleshooting: [SUPPORT.md](SUPPORT.md)
- Security/reporting: [SECURITY.md](SECURITY.md)
- Publishing: [PUBLISHING.md](PUBLISHING.md)

## Identity

- Publisher: `jiying2007`
- Extension ID: `jiying2007.codex-change-safe`
- Settings: `safeCodexChange.*`

## License

MIT
