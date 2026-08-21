# Publishing

Codex PR Safe releases are built by GitHub Actions from the committed npm lockfile and a clean immutable source commit.

## Release gate

A release requires:

- committed `package-lock.json` matching `package.json` name/version/devDependencies;
- `npm run verify:lock` passing;
- English/Simplified-Chinese manifest localization key parity;
- runtime localization bundle parity and source-key coverage via `npm run verify:l10n`;
- unit/regression tests passing, including Codex CLI argv/capability and Safe-boundary contracts;
- latest VS Code Extension Host tests passing on Linux, Windows, and macOS;
- minimum supported VS Code `1.90.0` Extension Host test passing on Ubuntu;
- Simplified-Chinese localization smoke passing inside Extension Host;
- official `@vscode/vsce` packaging;
- VSIX content verification; and
- SHA-256 generation.

Validation jobs use read-only repository permissions. Only the final package/publish job receives `contents: write`.

## Clean release source

Release tags must point to a clean product commit. The tagged tree may contain only the permanent GitHub Actions workflows:

```text
.github/workflows/ci.yml
.github/workflows/release.yml
```

Temporary bootstrap/finalizer workflows or marker files must never be present in a release tag.

The release workflow enforces this before packaging.

## Versioning

Release tags use strict semantic versioning:

```text
vMAJOR.MINOR.PATCH
```

The tag version must match `package.json.version` and `package-lock.json`, and the tagged commit must be reachable from `main`.

## Create a release

After the version change has passed CI and is merged to `main`, the `Release` workflow detects the committed version bump automatically. It runs the full gate and, only after every validation and packaging job succeeds, creates the immutable `v<package.version>` tag and GitHub Release in the same run. Ordinary `main` pushes with no version change skip the release jobs.

Use the cross-platform local release CLI as the standard entry point:

```bash
npm run release:prepare -- X.Y.Z
git diff --check
git diff
npm run release:check
npm run release:push
```

`release:prepare` updates only `package.json`, `package-lock.json`, and `CHANGELOG.md`. `release:check` requires a synchronized `main`, exactly those three unstaged changes, an unused remote tag, and successful lock, test, and VSIX packaging gates. `release:push` reruns the full gate, commits and pushes only those files, then verifies that the exact pushed commit produced a successful Release workflow, matching immutable tag, published Release, VSIX, and `SHA256SUMS`. The CLI never creates or force-moves a local tag. Every command supports `--dry-run`; `release:push` also accepts `--timeout-minutes N`. `CODEX_RELEASE_GITHUB_TOKEN` is an optional local environment variable for authenticated API polling and must never be committed.

Pushing a matching tag remains a supported manual fallback:

```bash
git checkout main
git pull --ff-only
npm run verify:lock
npm ci --ignore-scripts --no-audit --no-fund
npm run check

# Replace X.Y.Z with package.json.version.
git tag vX.Y.Z
git push origin vX.Y.Z
```

Do not force-move release tags. A rerun safely reuses a tag only when it resolves to the same commit, and refreshes existing Release artifacts with `--clobber`.

## Package contents

The release gate requires these user-facing files inside the VSIX:

- `package.nls.json`
- `package.nls.zh-cn.json`
- `l10n/bundle.l10n.json`
- `l10n/bundle.l10n.zh-cn.json`
- `README.zh-CN.md`
- `images/icon.png`
- `src/core.js`
- `src/codex-safe-core/codex-cli.js`
- `src/codex-safe-core/safe-contract.js`
- `src/codex-safe-core/manifest.json`

Development-only content must not be shipped, including:

- `.git/`, `.github/`, `.vscode/`;
- tests and test runners;
- scripts;
- lockfiles;
- `SECURITY.md` and `PUBLISHING.md`;
- repository examples/config files; and
- release bootstrap/finalizer artifacts.

## Extension identity

The stable extension identity is:

```text
Publisher: jiying2007
Name:      codex-pr-safe
ID:        jiying2007.codex-pr-safe
Namespace: safeCodexPr.*
```

Do not rename the extension `name` or command/settings namespace as part of publication; doing so creates a different Marketplace identity or breaks upgrade continuity.

## VS Code Marketplace

Marketplace publication is intentionally separate from the GitHub Release gate until publisher authentication is finalized.

When Marketplace publication is enabled, reuse the same validated VSIX rather than rebuilding an unverified package, keep publishing credentials outside the repository, and do not weaken the existing GitHub Release gate.
