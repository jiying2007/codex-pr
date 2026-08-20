# Security

## Data flow

Codex PR Safe sends only explicitly collected committed Git context and PR-generation instructions to the configured Codex service. The repository itself is not used as the Codex working directory.

The supplied context can include commit subjects, diff stat, name status, textual diff, a small committed PR template, and a committed `.codex-pr.json` policy. This source-derived material still leaves the local machine for model inference. Use the extension only where your organization’s source-code and data policy permits it.

## Execution boundary

For PR generation, the extension:

- runs Codex from a newly created empty temporary directory;
- requests a read-only sandbox and no approvals;
- ignores user Codex config and project execution rules for the request;
- disables unnecessary shell, execution, web, app, agent, hook, goal, memory, and plugin-related features where supported;
- validates Structured Output locally before formatting PR Markdown;
- never automatically fetches, pulls, pushes, creates, updates, or submits a pull request.

Organization-managed Codex requirements, managed hooks, MDM settings, or cloud policy may have higher precedence. The extension does not attempt to bypass organization policy.

## Configuration boundary

All `safeCodexPr.*` VS Code settings are application-scoped User Settings. Workspace and folder settings cannot change PR-generation policy.

Repository `.codex-pr.json` is treated as repository-controlled policy and is read from the exact committed `HEAD` object used for the PR snapshot. Uncommitted edits do not affect generation. Repository policy cannot configure the Codex executable, model, environment variables, working directory, or arbitrary commands.

PR templates are also read from committed `HEAD`. Git symbolic-link entries are not followed, preventing repository-controlled paths from escaping to host filesystem content.

## Repository consistency

A generated PR must describe the exact committed state that was analyzed. The extension snapshots:

- the current `HEAD` object ID;
- the selected Base object ID; and
- the normalized Base ref.

The snapshot is checked before and after PR input collection, after Codex returns, and again before every Copy/Open egress action. Any mismatch fails safe. A stale preview disables Copy/Open until regeneration.

A newer generation request supersedes an older in-flight request for the same repository.

## Base and remote safety

Codex PR Safe does not run network Git commands. Base detection uses only local refs.

Fork behavior is determined from actual configured remotes rather than branch-name heuristics. A slash in a branch name does not imply a remote. If no high-confidence Base can be inferred, the extension asks the user instead of selecting an arbitrary ref.

GitHub Compare targets are derived from configured remotes, current push configuration, and published local remote refs. Opening GitHub never submits a PR.

## Structured output and test claims

Codex output must match a closed JSON Schema and is validated again locally. Summary and Changes must be non-empty. Medium/high risk and breaking-change results must include concrete risk entries.

Codex PR Safe does not ingest a verified test-run result. Therefore test execution status is not model-controlled: the Testing section is generated locally and explicitly states that execution was not verified by Codex PR Safe.

## Process handling

Native executables are started without a shell. On Windows, `.cmd` and `.bat` shims are invoked through `cmd.exe` with explicit quoting and `windowsVerbatimArguments`.

Timeouts, cancellation, process-tree termination, stdout/stderr size limits, expected stdin `EPIPE`, and Codex executable checks are handled explicitly.

Before generation, the extension checks `codex --version`, `codex --help`, and `codex exec --help` to confirm the CLI exposes the safety and structured-output capabilities required by the current argv contract. Capability results are cached by executable/version.

## Localization boundary

Manifest strings use `package.nls.json` / `package.nls.zh-cn.json`. Runtime user-facing strings use the VS Code runtime localization path under `l10n/`.

CI verifies manifest key parity, runtime bundle key parity, runtime source-key coverage, and a Simplified-Chinese Extension Host smoke so shipped localization is exercised rather than only statically compared.

## Logging

The persistent Output channel must not contain source code, committed diff contents, generated PR text, secrets, raw Codex stderr, or absolute repository paths. It records only lifecycle information and error identifiers suitable for troubleshooting.

Interactive error notifications can show a bounded error detail to the active user, but that detail is not written to the persistent Output channel.

## Release supply chain

GitHub Actions validation jobs run with read-only repository permissions. Only the final release job receives `contents: write`.

Release tags must:

- use `vMAJOR.MINOR.PATCH`;
- match `package.json.version` and committed lockfile metadata;
- point to a commit reachable from `main`; and
- contain only the permanent `ci.yml` and `release.yml` workflows, with no bootstrap/finalizer markers.

The release gate runs:

- lockfile integrity verification;
- manifest/runtime localization parity and runtime source-key coverage;
- unit/regression tests;
- latest VS Code Extension Host tests on Linux, Windows, and macOS;
- minimum supported VS Code `1.90.0` compatibility testing;
- Simplified-Chinese localization smoke testing;
- official `@vscode/vsce` packaging;
- VSIX content checks; and
- SHA-256 generation.

Third-party GitHub Actions are pinned to immutable commit SHAs and maintained through Dependabot.
