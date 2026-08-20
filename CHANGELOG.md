# Changelog

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
