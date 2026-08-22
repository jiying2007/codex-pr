# Codex PR Safe

[English](README.md) | [简体中文](README.zh-CN.md)

Generate a validated pull-request title and description from **committed Git changes only**, combine deterministic local evidence, and keep the final remote write under human control.

Codex PR Safe is the narrative/provenance stage of the **Codex Safe Git Workflow** family:

```text
Codex Review Safe
      ↓ Review Receipt v4
Codex Commit Safe
      ↓ Commit Receipt v4
Codex PR Safe
      ↓ local preview + verified provenance
      ↓ human submission
```

Shared safety/runtime infrastructure comes exclusively from the pinned [`codex-safe-core`](https://github.com/jiying2007/codex-safe-core) Git submodule.

## What it does

- Analyzes committed `base...HEAD` changes only; local staged/unstaged worktree changes are excluded.
- Detects a conservative Base from local Git refs and fork topology without implicit network access.
- Generates structured PR title/summary/changes/risks/review notes in Simplified Chinese or English.
- Uses Safe Core Semantic Context Budget for both the native PR command and the GitHub Pull Requests title/description provider.
- Adds Testing status locally and never lets the model claim unverified test success.
- Consumes Codex Review Safe range evidence.
- Consumes Codex Commit Safe range evidence and displays verified Commit provenance.
- Rejects stale results when HEAD, branch, Base OID or Base ref changes.
- Provides an editable local preview before Copy/Open actions.

## What it never does

- It never runs `git fetch`, `git pull` or `git push` implicitly.
- It never creates or submits a remote pull request automatically.
- It never modifies project source files.
- It never gives Codex shell access.
- It never gives Codex network/web-search access.
- It never presents AI review receipts as human approval.
- It never presents generated text as test evidence.

## Safety boundary

Safe Core v3 requires the Codex CLI capabilities needed for:

- `--ask-for-approval never`
- `exec --json`
- ephemeral execution
- ignored user/project Codex rules for this request
- read-only sandbox
- Structured Output schema
- explicit disabling of shell, unified exec, web search, apps, hooks, memories, multi-agent and related capabilities

Missing required capabilities cause a fail-closed upgrade error. There is no legacy CLI fallback.

Repository-derived text—diffs, commit messages, filenames, PR templates, repository policy and previous generated text—is always treated as untrusted data.

## Semantic context for large PRs

`maxDiffBytes` is a **model semantic-context budget**, not a “truncate the first N bytes” or “reject immediately” threshold.

Safe Core processes unified diff by file:

- source files receive a fair per-file budget;
- generated/lock files are metadata-only;
- binary files are metadata-only;
- oversized source files keep bounded head/tail context;
- the native PR path has a fixed 8 MiB raw-diff safety ceiling;
- the GitHub Pull Requests provider applies the same semantic-budget policy to provider patch context.

Commit-list context has an independent `maxCommitBytes` ceiling.

## Repository policy

The only repository policy file is `.codex-safe.json` with `schemaVersion: 3`.

```json
{
  "$schema": "https://raw.githubusercontent.com/jiying2007/codex-safe-core/4dc4de836625a8b70084531eb3321734eca675d0/codex-safe.schema.json",
  "schemaVersion": 3,
  "pr": {
    "language": "en",
    "baseBranch": "upstream/main",
    "maxDiffBytes": 524288,
    "maxCommitBytes": 65536,
    "titleMaxLength": 100,
    "maxBodyChars": 8000,
    "includePullRequestTemplate": true,
    "extraInstructions": "Prefer concise engineering language and call out migration impact when relevant.",
    "timeoutSeconds": 120
  }
}
```

Only the policy committed in **HEAD** is effective. PR templates are also read from HEAD; symbolic links are not followed.

Repository policy cannot select the Codex executable or model. `safeCodexPr.codexPath` is machine-scoped and the remaining user preferences are application-scoped.

## Base and fork behavior

Codex PR Safe does not contact the network to discover branches. It uses local evidence in this order:

1. valid configured `baseBranch`;
2. fork-aware local `upstream/HEAD`;
3. local `origin/HEAD` / `upstream/HEAD`;
4. common local refs such as `origin/main`, `upstream/main`, `main`, `master`, `develop`, `dev`;
5. if confidence is insufficient, ask the user instead of guessing.

A slash does not imply a remote. `release/1.0` is a local branch unless `release` is an actual configured remote.

For GitHub Compare, the current branch push target is resolved from configured Git remotes/branch settings. The extension verifies the local remote topology and never pushes on behalf of the user.

## Review and Commit provenance

PR Safe obtains two independent local evidence channels:

### Review evidence

Codex Review Safe revalidates first-parent commit diffs against Review Receipt v4 history and returns counts such as reviewed and blocked commits.

### Commit provenance

Codex Commit Safe stores pending Commit Receipt v4 records after generation. During PR evidence lookup it recomputes each first-parent commit's:

- parent HEAD;
- full commit diff;
- final Git commit message.

Only an exact fingerprint match binds a pending receipt to the real `commitOid`.

PR Safe can therefore report deterministically:

- how many commits were generated by Codex Commit Safe and still match their receipts;
- how many of those generated commits were bound to matching Codex Review Safe receipt fingerprints.

Changing the commit message, content or parent breaks provenance automatically.

These receipts are AI workflow evidence, not human approval, build evidence or test evidence.

## Deterministic PR body

The model returns only structured narrative fields. Final Markdown is formatted locally, including the Testing status.

```text
## Summary
- ...

## Changes
- ...

## Testing
- Test execution was not verified by Codex PR Safe.

## Risk
- ...
- Risk level: low|medium|high
- Breaking change: Yes|No

## Review Notes
- ...

## Review Evidence
- deterministic receipt coverage, when available

## Commit Provenance
- deterministic Commit receipt coverage, when available
```

The local Base...Head compare range is appended separately.

## Preview and stale-result protection

Before generation completes and before every Copy/Open egress action, PR Safe verifies the repository identity:

```text
HEAD OID + current branch + Base OID + Base ref
```

If any component changed, the result becomes stale and must be regenerated.

Opening GitHub only opens a Compare page and copies the locally reviewed title/body. Final remote submission remains manual.

## GitHub Pull Requests provider

When `GitHub.vscode-pull-request-github` exposes its title/description provider API, Codex PR Safe can register as a provider without making that extension a hard dependency.

The provider path uses the same Safe Core Codex contract and Semantic Context Budget as the native PR command. Local file-URI metadata and issue content are intentionally omitted from model input.

## Usage

1. Commit the changes intended for the PR.
2. Ensure the desired local Base ref is current; run `git fetch` yourself when needed.
3. Open **Source Control**.
4. Run **Codex PR Safe: Generate PR**.
5. Review/edit the local preview.
6. Copy the title/body or open GitHub Compare.
7. Submit the PR manually after final review.

## Requirements

- VS Code `1.90.0` or newer
- Git
- OpenAI Codex CLI installed and authenticated where the workspace extension host runs
- trusted local filesystem-backed Git workspace

## Build and test

```bash
git submodule update --init --recursive
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run test:integration
npm run package
```

Marketplace/Release runtime is `dist/extension.js`. The VSIX contains only the deterministic staged runtime under `dist/`, `dist/codex-safe.schema.json`, localization, icon and release documentation. Source, tests, scripts and submodule metadata are rejected by CI package-boundary checks.

CI gates include:

- static/contract/provider tests;
- unit/regression tests;
- Linux/Windows/macOS Extension Host tests;
- minimum VS Code `1.90.0`;
- Simplified-Chinese localization smoke;
- official VSIX boundary audit and SHA-256 generation.

## Release integrity

A version change on `main` runs the complete release gate. The immutable tag and GitHub Release are created only after validation and integration tests pass.

Release artifacts include:

- `codex-pr-safe-<version>.vsix`
- `SHA256SUMS`
- GitHub build-provenance attestations for both artifacts

Only the final release job receives `contents: write`, `id-token: write`, and `attestations: write`; validation jobs remain read-only. Actions are pinned to immutable full commit SHAs.

See [SECURITY.md](SECURITY.md) and [PUBLISHING.md](PUBLISHING.md).

## Product-family boundary

| Product | Responsibility | Does not do |
| --- | --- | --- |
| Codex Review Safe | Staged-change quality gate + Review Receipt | write code / commit |
| Codex Commit Safe | Commit message + verified Commit Receipt | commit / push |
| **Codex PR Safe** | PR narrative + verified provenance | push / submit PR automatically |

The design principle is: **AI-assisted Git workflow without surrendering control of Git to the AI.**

## License

MIT
