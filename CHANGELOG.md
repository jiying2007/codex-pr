# Changelog

## Unreleased

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
- Keep the stricter 1.0.1 PR safety model intact: fork-aware Base resolution, HEAD-only repository inputs, deterministic Testing status, stale Copy/Open rejection, CLI capability probing, and clean release tags.

## 1.0.1

- Make Base detection fork-aware: recognized fork topologies prefer the committed upstream target while explicit Base configuration still wins.
- Stop guessing remotes from branch names; local branches such as `release/1.0` remain intact unless the prefix is an actual configured Git remote.
- Resolve GitHub push targets through `branch.<name>.pushRemote`, `remote.pushDefault`, tracking remote, and verified configured remotes.
- Fail closed when no high-confidence Base can be inferred and require explicit selection instead of choosing an arbitrary ref.
- Read `.codex-pr.json` and PR templates exclusively from committed `HEAD` Git objects; ignore uncommitted edits and do not follow repository symlinks.
- Revalidate `HEAD OID + Base OID + Base ref` before every Copy/Open action and mark stale previews as non-exportable until regeneration.
- Make Testing deterministic: the model can no longer report test execution status, and the locally formatted PR explicitly states that test execution was not verified by Codex PR Safe.
- Require non-empty Summary/Changes and require concrete risks for medium/high risk or breaking changes.
- Add Codex CLI capability preflight using `codex --help` / `codex exec --help`, cached by executable/version, instead of relying only on `--version`.
- Avoid splitting Unicode surrogate pairs when truncating titles and handle expected child-process stdin `EPIPE` safely.
- Keep persistent Output logging limited to lifecycle/error codes rather than raw Codex stderr, generated text, diffs, or repository paths.
- Expand regression and Extension Host coverage for fork Base selection, local slash branches, committed-only config/template input, symlink boundaries, stale result rejection, deterministic Testing, and CLI capability probing.

## 1.0.0

- Initial Codex PR Safe release.
- Generate structured PR titles and descriptions from committed `base...HEAD` changes.
- Add English and Simplified Chinese UI/output support.
- Add editable safe preview with copy, regenerate, base-selection, and GitHub Compare actions.
- Add local-ref base detection, same-repository/fork GitHub remote parsing, and published-branch checks.
- Run Codex in an empty temporary directory with read-only/no-approval/no-web/minimal-tool constraints.
- Add HEAD/base stale-result rejection, oversized-input fail-closed behavior, and repository prompt-injection boundaries.
- Add unit/regression and cross-platform VS Code Extension Host test scaffolding.
- Add pinned GitHub Actions CI and GitHub Release workflows.
