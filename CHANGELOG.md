# Changelog

## Unreleased

## 2.1.0

- Pin the final Codex Safe Core 2.1 baseline with canonical repository-policy validation, closed receipt contracts, hardened process execution, Git token validation, deep-frozen policy values, and Semantic Context budgeting.
- Remove the ambiguous PR product `src/core.js` boundary; keep pure PR algorithms in `pr-domain.js` and HEAD/User policy composition in `policy.js`.
- Separate application-level user style preferences from committed HEAD repository instructions in the model prompt so trust provenance remains explicit.
- Harden PR Base/ref handling through the canonical Core Git token validator while preserving fork-aware deterministic Base/remote behavior.

## 2.0.0

- Breaking: hard-switch to Codex Safe Core v2 through a commit-pinned Git submodule; remove copied vendoring, legacy bootstrap/startup activation, compatibility shims, and old Core ownership from the PR repository.
- Replace `.codex-pr.json` with the unified `.codex-safe.json` schema v2 `pr` section; v1 policy is intentionally unsupported.
- Route both the native PR flow and the optional GitHub Pull Requests title/description provider through the same Safe Core Semantic Context Budget, with generated/lock/binary metadata-only handling and a fixed native 8 MiB raw-diff safety ceiling.
- Add deterministic Commit Receipt v2 provenance consumption in addition to Review Receipt v2 range evidence; commit message/content/parent mismatches invalidate provenance automatically.
- Keep Testing locally deterministic and separate AI receipt coverage from human approval, build, and test evidence.
- Standardize the Marketplace runtime on deterministic `dist/` staging plus `dist/codex-safe.schema.json`, with CI rejecting source/tests/scripts/submodule metadata in VSIX artifacts.
- Unify CI/release gates across latest Linux/Windows/macOS and VS Code `1.90.0`, retain zh-CN coverage, and add SHA-256 plus full-SHA-pinned GitHub build-provenance attestations.
- Rewrite English/Chinese user, security, and publishing documentation around the v2 product-family contract.

## 1.0.3

- Automatically create the immutable version tag and GitHub Release after a committed version bump reaches `main`, while retaining the manual tag-push fallback.
- Make release reruns idempotent and reject existing lightweight or annotated tags that resolve to a different commit.

- Support test repositories on Git versions that predate `git init -b`.
- Consume matching Codex Review Safe receipts for committed first-parent ranges without treating AI review as human approval or test evidence.
- Use the versioned Codex Safe argv/compatibility contract shared with Commit and Review.
- Add offline quality fixtures for deterministic evidence-boundary behavior.

## 1.0.2

- Align English/Simplified-Chinese README navigation and product-family naming with Codex Commit Safe and Codex Review Safe.
- Make every `safeCodexPr.*` VS Code setting application-scoped so Workspace/Folder Settings cannot become an uncommitted repository policy channel.
- Add standard VS Code runtime localization bundles under `l10n/` while preserving generated PR language as an independent setting.
- Add manifest/runtime localization parity and runtime source-key coverage validation plus a real zh-CN Extension Host smoke gate.
- Add `SECURITY.md` and `PUBLISHING.md` documenting data flow, committed policy boundaries, process handling, logging, clean-tag rules, stable extension identity, and release supply-chain requirements.
- Tighten VSIX packaging rules: require runtime l10n bundles and icon, exclude security/publishing/development files, and remove old bootstrap ignore residue.
- Add repository editor settings and explicit VSIX/ZIP binary attributes for product-family consistency.
- Keep the stricter PR safety model intact: fork-aware Base resolution, HEAD-only repository inputs, deterministic Testing status, stale Copy/Open rejection, CLI capability probing, and clean release tags.

## 1.0.1

- Make Base detection fork-aware and fail closed when no high-confidence Base can be inferred.
- Read repository controls exclusively from committed HEAD objects and reject stale Copy/Open operations.
- Make Testing deterministic and strengthen CLI capability/output validation.

## 1.0.0

- Initial Codex PR Safe release.
