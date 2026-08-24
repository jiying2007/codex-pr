# Codex PR Safe

[English](README.md) | [简体中文](README.zh-CN.md)

A VS Code extension that generates a locally validated pull-request title and description from **committed Git changes only**, adds deterministic local provenance, and keeps the final remote write under human control.

## Start here

Use this product after the intended PR changes have been committed. Local staged/unstaged edits are deliberately excluded from the PR range.

Requirements:

- VS Code 1.90.0+
- Git
- OpenAI Codex CLI installed and authenticated in the same environment where the workspace Extension Host runs
- a trusted local-filesystem Git workspace

For Remote SSH, Dev Containers, Codespaces or WSL, install/authenticate Codex in that remote environment and configure `safeCodexPr.codexPath` there.

### First successful PR draft

1. Commit the changes intended for the PR.
2. Make sure your local Base ref is current; run `git fetch` yourself if needed.
3. Run **Codex PR Safe: Check Codex Environment** once.
4. Run **Codex PR Safe: Generate PR** from Source Control.
5. Review/edit the local preview.
6. Copy title/body or open GitHub Compare.
7. Submit the PR manually.

If generation reports `ENOCHANGES`, first check:

```bash
git status --short
git rev-list --count <base>..HEAD
git log --oneline <base>..HEAD
```

If `rev-list` is `0` but `git status` shows modifications, the changes are not committed yet and cannot be part of a PR. See [Getting Started](docs/GETTING_STARTED.md).

## What it guarantees

- committed `base...HEAD` only; working-tree edits never leak into PR evidence;
- conservative Base detection from local refs/fork topology with no implicit fetch/pull/push;
- Structured PR narrative with locally generated Testing status;
- Safe Core Semantic Context Budget for native and GitHub Pull Requests provider paths;
- deterministic Review Receipt v4 and Commit Receipt v4 range evidence when available;
- HEAD/current branch/Base OID/Base ref changes invalidate stale output;
- local editable preview before every copy/open egress;
- Safe Contract v2 runs Codex ephemeral/read-only/no-approval with shell/web/apps/multi-agent/plugins/hooks/goals/memories/dependency installation disabled;
- no source edits, push, or automatic remote PR submission.

Shared safety/runtime behavior comes only from the exact commit-pinned `codex-safe-core` v4 submodule.

## Repository policy

The only repository policy is committed `.codex-safe.json` with `schemaVersion: 3`:

```json
{
  "$schema": "https://raw.githubusercontent.com/jiying2007/codex-safe-core/6c0417a376179c295433c18b1b077854d290243d/codex-safe.schema.json",
  "schemaVersion": 3,
  "pr": {
    "language": "en",
    "baseBranch": "origin/main",
    "maxDiffBytes": 524288,
    "maxCommitBytes": 65536,
    "titleMaxLength": 100,
    "maxBodyChars": 8000,
    "includePullRequestTemplate": true,
    "timeoutSeconds": 120
  }
}
```

Only policy committed in HEAD is effective. PR templates are also read from HEAD and symlinks are not followed.

## Base selection

PR Safe uses local evidence only: configured `baseBranch`, fork-aware `upstream/HEAD`, `origin/HEAD`, common local refs, then user selection if confidence is insufficient. It never silently fetches or guesses a remote branch from a slash in a branch name.

## Family workflow

```text
staged changes
    ↓
Codex Review Safe → Review Receipt v4
    ↓
Codex Commit Safe → Commit Receipt v4
    ↓
manual git commit
    ↓
Codex PR Safe → PR narrative + verified provenance
    ↓
human PR submission
```

PR Safe can be used independently; Review/Commit evidence enriches provenance when available.

## Install, upgrade and verify

Install from the VS Code Marketplace or an immutable GitHub Release VSIX. After upgrading, run **Check Codex Environment** before the first generation.

Release artifacts are built once, checksummed and attested. See [VERIFY_RELEASE.md](VERIFY_RELEASE.md) and [PUBLISHING.md](PUBLISHING.md).

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
- Extension ID: `jiying2007.codex-pr-safe`
- Settings: `safeCodexPr.*`

## License

MIT
