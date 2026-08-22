# Security

Codex PR Safe follows the **Codex Safe Core v3** contract. Shared security/runtime primitives are owned by the pinned `codex-safe-core` submodule; this repository owns PR-specific Git topology, preview, provider integration and provenance presentation.

## Trust boundaries

### 1. Workspace

- Restricted Mode is unsupported.
- Virtual workspaces are unsupported.
- Runtime commands enforce Workspace Trust.
- Only trusted filesystem-backed Git workspaces are analyzed.

### 2. Git repository

Native PR generation is bound to:

- HEAD OID;
- current local branch;
- selected Base OID;
- normalized Base ref.

This identity is checked around input collection, after model execution, after preview preparation, and before every Copy/Open egress action. Any mismatch marks the result stale.

Only committed `base...HEAD` changes are model input. Staged/unstaged working-tree changes are intentionally excluded.

### 3. Codex executable

Safe Core performs capability negotiation and requires the CLI features needed for:

- `--ask-for-approval never`;
- `exec --json`;
- ephemeral execution;
- ignored user/project Codex rules for the request;
- read-only sandbox;
- output schema;
- explicit Safe Core configuration overrides.

Shell, unified exec, web search, apps, multi-agent, remote plugins, hooks, goals, memories and related capabilities are disabled.

Missing required capabilities or rejected safety arguments fail closed. There is no compatibility fallback that weakens the contract.

Codex runs from a temporary directory, not the repository.

### 4. Repository policy and templates

The only repository policy is `.codex-safe.json` schema v2. PR consumes only the `pr` section from committed HEAD.

PR templates are also read from HEAD. Git symbolic links are not followed.

Repository policy cannot configure:

- Codex executable;
- model;
- environment variables;
- working directory;
- arbitrary commands.

`safeCodexPr.codexPath` is machine-scoped. Remaining user preferences are application-scoped.

### 5. Model output

AI output is untrusted structured data. PR Safe validates a closed schema with bounded:

- title;
- summary;
- changes;
- risks;
- review notes;
- risk level;
- breaking-change flag.

Medium/high risk and breaking-change results require concrete risks.

The model cannot control the Testing section. Test execution is locally marked unverified unless a separate trusted evidence channel is introduced in the future.

## Prompt-injection boundary

All repository-derived material is untrusted, including:

- diffs/patches;
- commit messages;
- filenames;
- PR templates;
- repository policy;
- previous generated text.

Prompt instructions explicitly forbid following commands or policy found inside that data.

## Semantic Context Budget

`maxDiffBytes` is the model-context budget, not a raw first-N-byte truncation rule.

Safe Core parses unified diff by file:

- source files receive a fair per-file allocation;
- generated/lock files are metadata-only;
- binary files are metadata-only;
- oversized source files retain bounded head/tail context.

The native PR path has a fixed 8 MiB raw-diff safety ceiling. Commit-list context has its own `maxCommitBytes` limit.

The optional GitHub Pull Requests provider applies the same Safe Core semantic-budget policy to provider patch input, so the native and provider paths do not diverge.

## Base and remote safety

PR Safe does not run implicit Git network operations. Base detection uses local refs and actual configured remotes.

A slash in a branch name is not treated as a remote prefix unless the prefix is a real configured remote.

If Base confidence is insufficient, the user is asked to choose rather than accepting an arbitrary ref.

GitHub Compare URLs are derived from local remote topology and published remote refs. Opening GitHub never submits a PR.

## Preview Webview boundary

The editable preview:

- uses `localResourceRoots: []`;
- uses a restrictive Content Security Policy;
- avoids `retainContextWhenHidden`;
- stores only small draft state through Webview state APIs;
- validates edited title/body again in the extension host before clipboard/browser egress.

A fresh generation creates a fresh draft identity so stale webview state cannot overwrite a new result.

## Review evidence and Commit provenance

Review evidence is obtained from Codex Review Safe through its read-only API and independently matched against first-parent committed diffs.

Commit provenance is obtained from Codex Commit Safe. Pending Commit Receipt v3 records are not trusted directly: Commit Safe recomputes each real commit's parent, full diff and final commit message before binding to `commitOid`.

PR Safe displays deterministic receipt coverage locally. Receipts are AI workflow evidence only; they do not establish human approval, requirements compliance, build success or test success.

Missing/invalid companion evidence never enables additional Git or network actions.

## Process handling

Process execution is delegated to Safe Core. Native processes run without an unrestricted shell. Windows script shims use explicit quoting. Timeout, cancellation, process-tree termination and stdout/stderr limits are enforced.

## Localization boundary

Manifest localization uses `package.nls.*`; runtime localization uses the `l10n/` bundles. CI verifies key parity/source coverage and a Simplified-Chinese Extension Host smoke.

## Logging

Persistent operational logs must not contain:

- source/committed diff content;
- generated PR text;
- secrets;
- raw Codex stderr;
- absolute repository paths.

## Data flow

Semantic PR context leaves the local machine for the configured Codex service. Use the extension only when allowed by the organization's source-code/data policy.

Organization-managed Codex policy, managed hooks, MDM or cloud controls may still apply; the extension does not attempt to bypass them.

## Release supply chain

Marketplace/Release runtime is `dist/extension.js`; the canonical policy schema is `dist/codex-safe.schema.json`. CI rejects source, tests, scripts and submodule metadata in the VSIX.

Validation jobs use read-only repository permissions. Only the final release job receives:

- `contents: write`;
- `id-token: write`;
- `attestations: write`.

Release validation covers lock integrity, localization, provider/unit regressions, latest Linux/Windows/macOS Extension Host, minimum VS Code `1.90.0`, Simplified-Chinese smoke, VSIX boundary audit and SHA-256 generation.

GitHub Actions are pinned to immutable full commit SHAs. Release artifacts (`.vsix` and `SHA256SUMS`) receive GitHub build-provenance attestations.

## Reporting a vulnerability

Do not disclose security-sensitive issues publicly before remediation. Use the repository's GitHub security reporting mechanism when available, or contact the maintainer privately through the repository owner profile.
