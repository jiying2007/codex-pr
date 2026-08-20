# Codex PR Safe

English | [简体中文](README.zh-CN.md)

Codex PR Safe is a VS Code extension that generates a **reviewable pull request title and description from committed Git changes** using your local OpenAI Codex CLI.

It is the PR companion to **Codex Commit Safe** and **Codex Review**: deterministic Git input, structured Codex output, local formatting, explicit stale-result protection, and no automatic remote write.

## What it does

- Compares the current branch with a selected local Git base ref.
- Uses committed history only: merge base, commit list, diff stat, name status, and textual diff.
- Keeps staged/unstaged working-tree changes out of PR analysis.
- Generates structured title, summary, changes, risks, review notes, risk level, and breaking-change metadata.
- Adds the **Testing** section locally and always states that test execution was not verified; the model cannot claim tests passed.
- Formats final Markdown locally and opens an editable preview.
- Supports English and Simplified Chinese output independently from the VS Code UI language.
- Supports same-repository and fork GitHub Compare URLs when local remotes are recognizable.
- Never fetches, pushes, creates, updates, or submits a remote pull request automatically.

## Safety model

Codex PR Safe is deliberately conservative:

1. **Trusted local workspace only.** Restricted Mode and virtual workspaces are unsupported.
2. **Committed range only.** PR source data comes from committed `base...HEAD` state. Staged/unstaged changes are excluded.
3. **Committed repository controls only.** `.codex-pr.json` and PR templates are read from the `HEAD` Git object, not the working tree. Repository symlinks are not followed.
4. **No implicit Git network operations.** The extension never runs `fetch`, `pull`, or `push`; base refs are whatever you already have locally.
5. **Read-only Codex execution.** Codex runs in an empty temporary directory with `read-only` sandboxing, approvals disabled, web search disabled, and shell/app/multi-agent capabilities disabled.
6. **CLI capability preflight.** Before generation, the extension checks `codex --help` and `codex exec --help` for the safety and structured-output capabilities it requires. The result is cached by executable/version.
7. **Prompt-injection boundary.** Diffs, filenames, commit messages, PR templates, previous output, and repository configuration are explicitly treated as untrusted data.
8. **Structured output.** Codex must return a closed JSON Schema. Summary and changes must be non-empty, and non-low risk requires concrete risks.
9. **Deterministic test status.** Codex PR Safe does not ingest a verified test-run result, so it never lets the model assert that tests passed. The Testing section is generated locally as “not verified.”
10. **Stale-result rejection.** The extension snapshots `HEAD OID + base OID + base ref` during generation and rechecks it before every Copy/Open egress action. A stale preview disables those actions until regeneration.
11. **No remote PR write.** “Open GitHub PR” copies the editable title/body and opens the GitHub Compare page. You remain responsible for the final submission.
12. **No sensitive Output logging.** The persistent Output channel logs lifecycle/error codes, not source diffs, commit contents, generated PR text, raw Codex stderr, or repository paths.

Organization-managed Codex policy can still apply; the extension does not attempt to bypass it.

## Requirements

- VS Code 1.90.0 or newer
- Git
- OpenAI Codex CLI available in the environment used by VS Code
- A trusted local Git workspace

Verify Codex first:

```bash
codex --version
codex --help
codex exec --help
```

## Commands

Open the Command Palette and run:

- `Codex PR Safe: Generate PR`
- `Codex PR Safe: Regenerate PR`
- `Codex PR Safe: Choose Base and Generate PR`
- `Codex PR Safe: Show Last PR`
- `Codex PR Safe: Copy PR Title`
- `Codex PR Safe: Copy PR Body`
- `Codex PR Safe: Copy PR Title and Body`
- `Codex PR Safe: Open GitHub PR`
- `Codex PR Safe: Check Environment`

The Source Control title bar exposes **Generate PR** (`git-pull-request`) and **Regenerate PR** (`redo`).

## Base branch behavior

Codex PR Safe does not contact the network to discover the remote default branch.

Selection rules are intentionally conservative:

1. A valid explicit `safeCodexPr.baseBranch` / committed `.codex-pr.json` value wins.
2. In a recognized fork topology (`origin` = fork, `upstream` = different GitHub repository), a local `upstream/HEAD` is preferred.
3. Otherwise a local `origin/HEAD`, then `upstream/HEAD`, is preferred.
4. Common local refs such as `origin/main`, `upstream/main`, `main`, `master`, `develop`, or `dev` are considered.
5. If no high-confidence base exists, the extension **does not pick an arbitrary branch**; it asks you to choose.

A slash no longer implies a remote. For example, a local branch named `release/1.0` remains a local branch unless `release` is an actual configured Git remote.

If remote refs may be stale, run `git fetch` yourself first. The extension intentionally does not do it for you.

## Fork and push-remote behavior

When opening GitHub Compare, remote resolution uses actual configured Git remotes rather than string guessing. For the current branch, the push target is resolved in this order:

1. `branch.<name>.pushRemote`
2. `remote.pushDefault`
3. `branch.<name>.remote`
4. `origin`
5. another configured remote

For a local Base branch, Codex PR Safe verifies which configured remote actually contains that branch before constructing the GitHub URL. In fork workflows it prefers `upstream` when appropriate.

## Preview workflow

After generation, the editable preview contains:

- PR title
- PR body
- compare range
- a warning when local uncommitted changes exist
- Copy Title / Copy Body / Copy All
- Regenerate
- Change Base
- Open GitHub PR

Before any Copy/Open action, the extension rechecks the generated snapshot. If HEAD or Base changed, the preview becomes **stale**, Copy/Open are disabled, and regeneration is required.

Opening GitHub never submits a PR. The current branch must already be published to the recognized GitHub push remote.

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `safeCodexPr.codexPath` | `codex` | Local Codex CLI path; user-only |
| `safeCodexPr.model` | empty | Optional Codex model override; user-only |
| `safeCodexPr.language` | `zh-CN` | Generated PR prose language (`zh-CN` / `en`) |
| `safeCodexPr.baseBranch` | empty | Optional default base ref such as `origin/main` |
| `safeCodexPr.maxDiffBytes` | `524288` | Maximum textual diff sent to Codex |
| `safeCodexPr.maxCommitBytes` | `65536` | Maximum commit-list bytes sent to Codex |
| `safeCodexPr.titleMaxLength` | `100` | Preferred local title limit |
| `safeCodexPr.maxBodyChars` | `8000` | Maximum formatted body length |
| `safeCodexPr.includePullRequestTemplate` | `true` | Include a small committed PR template as untrusted reference context |
| `safeCodexPr.extraInstructions` | empty | Team style guidance only |
| `safeCodexPr.timeoutSeconds` | `120` | Generation timeout |

`codexPath` and `model` cannot be overridden by repository-controlled configuration.

## Optional repository configuration

A repository may commit `.codex-pr.json`:

```json
{
  "language": "en",
  "baseBranch": "upstream/main",
  "titleMaxLength": 90,
  "maxBodyChars": 7000,
  "includePullRequestTemplate": true,
  "extraInstructions": "Prefer concise engineering language and mention migration impact when relevant."
}
```

Only the copy committed in **HEAD** is used. Uncommitted edits do not affect generation. Symbolic-link config is rejected and unknown keys are rejected. Repository config cannot choose a Codex executable or model.

PR templates are likewise read from HEAD and symlinks are skipped.

## PR body format

The final Markdown is locally formatted as:

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
```

The body also records the local Base...Head compare range.

## Large PRs

Oversized diffs **fail closed**. Codex PR Safe does not silently truncate the diff and pretend to have understood the entire PR. If a legitimate PR exceeds the configured limit, inspect its size and deliberately raise `safeCodexPr.maxDiffBytes` within the hard maximum.

## Installation from VSIX

```bash
code --install-extension codex-pr-safe-1.0.1.vsix
```

## Relationship to the Codex Safe workflow

```text
Code
  ↓
Codex Review
  ↓
Codex Commit Safe
  ↓
Codex PR Safe
  ↓
Human review / GitHub submission
```

## License

MIT. See [LICENSE](LICENSE).
