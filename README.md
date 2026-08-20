# Codex PR Safe

English | [简体中文](README.zh-CN.md)

Codex PR Safe is a VS Code extension that generates a **reviewable pull request title and description from committed Git changes** using your local OpenAI Codex CLI.

It is designed as the PR companion to **Codex Commit Safe** and **Codex Review**: deterministic Git input, structured Codex output, local formatting, explicit stale-result protection, and no automatic external write.

## What it does

- Compares the current branch against a selected local Git base ref such as `origin/main`.
- Uses committed history only: `merge-base`, commit list, diff stat, name status, and textual diff.
- Explicitly excludes staged/uncommitted working-tree changes from PR analysis.
- Generates structured fields: title, summary, changes, testing, risks, review notes, risk level, and breaking-change flag.
- Formats the final Markdown locally instead of asking the model to produce arbitrary PR Markdown.
- Shows an editable preview before you copy or open GitHub.
- Supports English and Simplified Chinese independently from the VS Code UI language.
- Supports same-repository and fork GitHub compare URLs when local remotes are recognizable.
- Never pushes, fetches, creates, updates, or submits a remote pull request automatically.

## Safety model

Codex PR Safe is deliberately conservative:

1. **Trusted local workspace only.** Restricted Mode and virtual workspaces are unsupported.
2. **Committed range only.** Local staged/unstaged changes are not mixed into the PR description.
3. **No implicit network Git operations.** The extension does not `fetch`, `pull`, or `push`; base refs are whatever you already have locally.
4. **Read-only Codex execution.** Codex runs in an empty temporary directory with `read-only` sandboxing, approvals disabled, web search disabled, and shell/app/multi-agent capabilities disabled.
5. **Prompt-injection boundary.** Diffs, filenames, commit messages, PR templates, previous output, and repository configuration are explicitly treated as untrusted data.
6. **Structured output.** Codex must return a closed JSON Schema. The extension validates it and formats Markdown locally.
7. **Evidence-aware testing text.** The model is forbidden from claiming tests passed unless supplied Git data actually provides that evidence; otherwise the final body states that test execution was not verified.
8. **Stale-result rejection.** The extension snapshots `HEAD OID + base OID + base ref` before collection, after collection, and before using the generated result.
9. **No remote PR write.** “Open GitHub PR” copies the editable title/body, then opens the GitHub Compare page. You remain responsible for the final remote submission.
10. **No sensitive logging.** The Output channel does not log source diffs, commit contents, generated PR text, or repository paths.

Organization-managed Codex policy can still apply; the extension does not attempt to bypass it.

## Requirements

- VS Code 1.90.0 or newer
- Git
- OpenAI Codex CLI available in the environment used by VS Code
- A trusted local Git workspace

Verify Codex first:

```bash
codex --version
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

The Source Control title bar also exposes **Generate PR** (`git-pull-request`) and **Regenerate PR** (`redo`).

## Base branch behavior

Codex PR Safe does not contact the network to discover the remote default branch. It uses local refs in this order:

1. `safeCodexPr.baseBranch` / `.codex-pr.json` if configured and present.
2. Local `origin/HEAD` or `upstream/HEAD` symbolic refs.
3. Common refs such as `origin/main`, `origin/master`, `upstream/main`, `main`, `master`, `develop`, or `dev`.
4. Another available local/remote branch ref.

Use **Choose Base and Generate PR** whenever you want explicit control.

If your remote refs may be stale, run `git fetch` yourself first. The extension intentionally does not do it for you.

## Preview workflow

After generation, Codex PR Safe opens an editable preview containing:

- PR title
- PR body
- compare range
- an explicit warning when local uncommitted changes exist
- Copy Title / Copy Body / Copy All
- Regenerate
- Change Base
- Open GitHub PR

Opening GitHub never submits a PR. The current branch must already be published to the recognized GitHub remote; otherwise the action is disabled.

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
| `safeCodexPr.includePullRequestTemplate` | `true` | Include a small PR template as untrusted reference context |
| `safeCodexPr.extraInstructions` | empty | Team style guidance only |
| `safeCodexPr.timeoutSeconds` | `120` | Generation timeout |

`codexPath` and `model` cannot be overridden by repository-controlled configuration.

## Optional repository configuration

A trusted repository may add `.codex-pr.json`:

```json
{
  "language": "en",
  "baseBranch": "origin/main",
  "titleMaxLength": 90,
  "maxBodyChars": 7000,
  "includePullRequestTemplate": true,
  "extraInstructions": "Prefer concise engineering language and mention migration impact when relevant."
}
```

Unknown keys are rejected. Repository config cannot choose a Codex executable or model.

## PR body format

The final Markdown is locally formatted as:

```text
## Summary
- ...

## Changes
- ...

## Testing
- ...

## Risk
- ...
- Risk level: low|medium|high
- Breaking change: Yes|No

## Review Notes
- ...
```

The generated body also records the local compare range.

## Large PRs

Oversized diffs **fail closed**. Codex PR Safe does not silently truncate the diff and pretend to have reviewed the full change. If a legitimate PR exceeds the configured limit, inspect its size and deliberately increase `safeCodexPr.maxDiffBytes` up to the hard maximum.

## Installation from VSIX

```bash
code --install-extension codex-pr-safe-1.0.0.vsix
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
