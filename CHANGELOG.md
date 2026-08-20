# Changelog

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
