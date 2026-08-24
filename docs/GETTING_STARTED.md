# Getting Started with Codex PR Safe

## 1. Prerequisites

Install VS Code 1.90+, Git and OpenAI Codex CLI in the environment hosting the workspace Extension Host. Authenticate Codex there:

```bash
codex --version
codex login
```

Remote SSH, Dev Containers, Codespaces and WSL require Codex inside the remote environment.

## 2. Install the extension

Install `jiying2007.codex-pr-safe` from the VS Code Marketplace or an immutable GitHub Release VSIX.

## 3. Check the environment

Open a trusted Git workspace and run **Codex PR Safe: Check Codex Environment**.

## 4. Prepare a PR range

PR Safe uses committed changes only.

```bash
git status --short
git rev-list --count origin/main..HEAD
git log --oneline origin/main..HEAD
```

Replace `origin/main` with the intended Base. If the count is zero, there is no committed PR range yet.

## 5. Generate the PR draft

Run **Generate PR**, review/edit the local preview, then copy title/body or open GitHub Compare. Final submission is manual.

## Common problems

### `ENOCHANGES`

Run:

```bash
git status --short
git rev-list --count <base>..HEAD
```

- count `0` + modified files in `git status`: changes are uncommitted; commit them first;
- count `0` + clean worktree: current branch has no commits ahead of Base;
- count > `0`: verify the selected Base is correct and inspect `git diff --stat <base>...HEAD`.

PR Safe intentionally does not include working-tree-only changes.

### Wrong Base

Run **Select Base and Generate** or configure `safeCodexPr.baseBranch`. PR Safe does not fetch automatically.

### Codex executable not found

Run `codex --version` in the same local/remote environment as the workspace and configure `safeCodexPr.codexPath` if required.

### Current branch is not published

Generation can still work locally. To open a valid GitHub Compare page, push the branch yourself first; PR Safe never pushes for you.

### Stale preview

If HEAD, current branch or Base changes after generation, regenerate before copying/opening.

## Upgrade

Upgrade from Marketplace or install a newer immutable VSIX, reload VS Code and run **Check Codex Environment** before the first generation.
