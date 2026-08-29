# Codex PR Safe — Retired

[English](README.md) | [简体中文](README.zh-CN.md)

This repository is retired and is no longer an active Codex Safe product.

The former VS Code extension generated Pull Request titles/descriptions from committed `base...HEAD` changes and integrated with GitHub Pull Requests. In the current product architecture this is not a sufficiently independent responsibility, and it duplicates work already performed elsewhere in the development/review flow.

## Current product boundary

The active family is intentionally narrower:

- [`codex-safe-core`](https://github.com/jiying2007/codex-safe-core) — shared safety/runtime/evidence primitives.
- [`codex-review`](https://github.com/jiying2007/codex-review) — developer-side pre-commit review.
- [`codex-commit`](https://github.com/jiying2007/codex-commit) — developer-side commit-message generation.
- [`codex-review-service`](https://github.com/jiying2007/codex-review-service) — server-side GitLab Self-Managed Merge Request review, publication, gate and audit.

No replacement PR/MR-description generator is planned. `codex-commit` intentionally does **not** generate PR/MR descriptions. PR/MR creation and metadata management belong to the SCM's native UI/CLI/API.

## Retirement policy

- No new features, bug fixes, releases or Marketplace publication.
- No compatibility shim and no successor VS Code extension.
- Historical commits/tags/releases remain only as historical artifacts; they are not part of the active family contract.
- Do not copy the former GitHub-specific provider, compare-URL or fork-topology logic into `codex-safe-core`.
- Shared semantic-context and efficiency primitives already live in `codex-safe-core`; there is no duplicate migration required from this repository.

See [`RETIRED.md`](RETIRED.md) for the architectural decision and migration guidance.
