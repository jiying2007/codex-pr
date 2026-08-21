# Codex PR Safe

[English](README.md) | [简体中文](README.zh-CN.md)

Generate safe, structured pull request titles and descriptions from **committed Git changes only** in VS Code using the local OpenAI Codex CLI.

> **Why “Safe”?** Codex PR Safe is the PR-side companion to [Codex Commit Safe](https://github.com/jiying2007/codex-commit) and [Codex Review Safe](https://github.com/jiying2007/codex-review). It deliberately keeps a narrow trust boundary: committed `base...HEAD` input, HEAD-pinned repository policy/templates, Structured Output, stale-result rejection, minimal Codex capabilities, no implicit Git network operations, and no automatic PR submission.

## Highlights

- One-click PR generation from VS Code Source Control
- Uses **committed changes only** (`merge-base...HEAD`); staged/unstaged worktree changes are excluded
- Fork-aware Base selection and GitHub Compare support
- Generated PR prose in **Simplified Chinese or English**
- VS Code commands, settings, progress, warnings, preview actions, and critical errors localized for **English and Simplified Chinese**
- UI language and generated PR language are independent
- Codex Structured Output with strict local schema validation and local Markdown formatting
- Deterministic Testing section: Codex PR Safe never claims tests passed without verified execution evidence
- HEAD + Base OID snapshot checks during generation and before every Copy/Open egress action
- HEAD-pinned `.codex-pr.json` and PR templates; uncommitted edits and repository symlinks cannot alter the request
- Optional committed-range evidence from matching Codex Review Safe receipts, explicitly separated from human approval and test evidence
- Windows `.exe` / `.cmd` / `.bat`, Linux, and macOS execution paths covered by CI
- Never automatically fetches, pulls, pushes, creates, updates, or submits a remote pull request

## Language support

The VS Code UI automatically follows the editor locale through the standard VS Code runtime localization mechanism:

- English VS Code → English commands/messages/preview text
- Simplified Chinese VS Code → Simplified Chinese commands/messages/preview text

The generated PR prose language is controlled separately:

```json
{
  "safeCodexPr.language": "zh-CN"
}
```

or:

```json
{
  "safeCodexPr.language": "en"
}
```

A Chinese UI can request an English PR description, and an English UI can request Chinese PR prose.

## Workflow

```text
Code
  ↓
Codex Review Safe
  ↓
Codex Commit Safe
  ↓
committed feature branch
  ↓
Codex PR Safe
  ↓
editable local preview
  ↓
GitHub Compare
  ↓
human final submission
```

## Requirements

- VS Code 1.90.0+
- Git
- OpenAI Codex CLI available in the environment used by VS Code
- A trusted local filesystem-backed Git workspace

Verify Codex first:

```bash
codex --version
codex --help
codex exec --help
```

## Installation

Download the VSIX from a GitHub Release and install it:

```bash
code --install-extension codex-pr-safe-1.0.2.vsix
```

Or in VS Code:

```text
Extensions → ... → Install from VSIX...
```

Then run:

```text
Ctrl+Shift+P → Codex PR Safe: Check Environment
```

## Usage

1. Commit the changes that belong in the PR.
2. Make sure the local Base ref is current; run `git fetch` yourself when needed.
3. Open **Source Control**.
4. Run **Codex PR Safe: Generate PR** or use the Source Control toolbar action.
5. Review and edit the generated title/body locally.
6. Copy the result or open the GitHub Compare page.
7. Submit the pull request manually after final review.

The Source Control toolbar uses `git-pull-request` for **Generate PR** and `redo` for **Regenerate PR**, avoiding the Git Refresh icon conflict.

## Base and fork behavior

Codex PR Safe never contacts the network to discover the default branch. Selection is intentionally conservative:

1. A valid explicit `safeCodexPr.baseBranch` / committed `.codex-pr.json` value wins.
2. In a recognized fork topology (`origin` = fork, `upstream` = another GitHub repository), local `upstream/HEAD` is preferred.
3. Otherwise local `origin/HEAD`, then `upstream/HEAD`, is preferred.
4. Common local refs such as `origin/main`, `upstream/main`, `main`, `master`, `develop`, or `dev` are considered.
5. If no high-confidence Base exists, the extension asks you to choose instead of guessing.

A slash does not imply a remote: `release/1.0` remains a local branch unless `release` is an actual configured remote.

For the current branch, the GitHub push target is resolved in this order:

1. `branch.<name>.pushRemote`
2. `remote.pushDefault`
3. `branch.<name>.remote`
4. `origin`
5. another configured remote

For a local Base branch, Codex PR Safe verifies which configured remote actually contains it before building the GitHub Compare URL.

## Preview and stale-result protection

The editable preview provides:

- PR title
- PR body
- Base...Head compare range
- dirty-worktree warning
- Copy Title / Copy Body / Copy All
- Regenerate
- Change Base
- Open GitHub PR

Before every Copy/Open action the extension rechecks `HEAD OID + Base OID + Base ref`. If the generated result is stale, Copy/Open is disabled until regeneration.

Opening GitHub never submits a PR. It copies the currently edited title/body and opens the compare page so the final remote write remains under human control.

## Safety model

Codex PR Safe is deliberately conservative:

1. **Trusted workspace only.** Restricted Mode and virtual workspaces are unsupported.
2. **Committed range only.** Model input is derived from committed `base...HEAD` history and diff data.
3. **Committed repository controls only.** `.codex-pr.json` and PR templates are read from the exact `HEAD` Git object; repository symlinks are not followed.
4. **User/application settings only.** All `safeCodexPr.*` VS Code settings are application-scoped. Repository customization is accepted only through committed `.codex-pr.json`.
5. **No implicit Git networking.** The extension never runs `fetch`, `pull`, or `push`.
6. **Read-only Codex execution.** Codex runs from an empty temporary directory with read-only sandboxing, approvals disabled, web search disabled, and unnecessary execution/app/agent features disabled.
7. **CLI capability preflight.** `codex --help` / `codex exec --help` are checked for the required safety and structured-output capabilities before generation.
8. **Prompt-injection boundary.** Repository-derived text is explicitly treated as untrusted data and cannot override safety/evidence rules.
9. **Structured Output.** Closed JSON Schema, local validation, non-empty Summary/Changes, and concrete risks for non-low-risk/breaking results.
10. **Deterministic Testing status.** The model cannot report execution success; the Testing section is generated locally as not verified.
11. **Stale-result rejection.** Snapshot checks protect collection, generation, Copy, and Open operations.
12. **No sensitive persistent logging.** Source diff, commit contents, generated PR text, raw Codex stderr, and absolute repository paths are not written to the persistent Output channel.

Organization-managed Codex policy may still apply; the extension does not attempt to bypass it.

See [SECURITY.md](SECURITY.md) for the full boundary and supply-chain model.

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `safeCodexPr.codexPath` | `codex` | Local Codex CLI path; user/application only |
| `safeCodexPr.model` | empty | Optional Codex model override; user/application only |
| `safeCodexPr.language` | `zh-CN` | Generated PR prose language (`zh-CN` / `en`) |
| `safeCodexPr.baseBranch` | empty | Optional default Base ref such as `upstream/main` |
| `safeCodexPr.maxDiffBytes` | `524288` | Maximum textual PR diff bytes sent to Codex |
| `safeCodexPr.maxCommitBytes` | `65536` | Maximum commit-list context bytes |
| `safeCodexPr.titleMaxLength` | `100` | Preferred local PR title limit |
| `safeCodexPr.maxBodyChars` | `8000` | Maximum locally formatted PR body length |
| `safeCodexPr.includePullRequestTemplate` | `true` | Include a small committed PR template as untrusted reference context |
| `safeCodexPr.extraInstructions` | empty | Optional team style guidance that cannot override safety rules |
| `safeCodexPr.timeoutSeconds` | `120` | Codex generation timeout |

All VS Code settings above are application-scoped. Workspace/folder settings cannot alter PR policy.

## Project configuration

A repository may commit `.codex-pr.json`:

```json
{
  "language": "en",
  "baseBranch": "upstream/main",
  "titleMaxLength": 90,
  "maxBodyChars": 7000,
  "includePullRequestTemplate": true,
  "extraInstructions": "Prefer concise engineering language and call out migration impact when relevant."
}
```

Only the copy committed in **HEAD** is used. Uncommitted edits do not take effect. Symbolic-link config is rejected, unknown keys are rejected, and repository policy cannot configure the Codex executable or model.

PR templates are likewise read from HEAD and symbolic links are skipped.

## PR body format

The final Markdown is formatted locally:

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

Oversized diffs **fail closed**. The extension never silently truncates the PR diff and pretends it understood the complete change. Raise `safeCodexPr.maxDiffBytes` deliberately only after reviewing the PR size.

## Extension identity

- Repository: `codex-pr`
- Extension name: `codex-pr-safe`
- Display name: **Codex PR Safe**
- Publisher/VSIX ID: `jiying2007.codex-pr-safe`
- Command/settings namespace: `safeCodexPr.*`
- Repository policy: `.codex-pr.json`
- Companion extensions: [Codex Commit Safe](https://github.com/jiying2007/codex-commit) and [Codex Review Safe](https://github.com/jiying2007/codex-review)
- Marketplace status: **not published yet**; GitHub Releases are the current distribution channel

## Development

```bash
npm run verify:lock
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run test:integration
npm run package
```

CI validates manifest/runtime localization parity, runtime source-key coverage, latest VS Code Extension Host on Linux/Windows/macOS, VS Code `1.90.0` minimum compatibility, a Simplified-Chinese localization smoke, official VSIX contents, and SHA-256 generation.

See [PUBLISHING.md](PUBLISHING.md) for release details.

## License

See [LICENSE](LICENSE).
