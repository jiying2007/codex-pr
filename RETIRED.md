# Retirement Decision

Status: final

`codex-pr` is retired as an independent product.

## Why

The extension's durable value was too narrow: it re-read an already committed change range to generate PR narrative, then handed the user back to GitHub for the actual PR write. In GitLab Self-Managed environments its GitHub-specific provider/opening path did not complete the workflow. Keeping it active also caused the same change to be interpreted repeatedly across Review, Commit, PR narrative and server-side MR Review.

## What remains active

The active Codex Safe family has four repositories/products with distinct responsibilities:

1. `codex-safe-core`: shared deterministic safety/runtime/evidence/context primitives.
2. `codex-review`: developer-side pre-commit review.
3. `codex-commit`: developer-side commit-message generation.
4. `codex-review-service`: server-side GitLab Self-Managed MR review, publication, gate, durability and audit.

`codex-commit` will not gain a PR/MR-description feature. There is no replacement `codex-mr` product.

## Code disposition

No source code from the retired extension is retained on `main` except these retirement records and the license. Git history preserves the old implementation when historical inspection is required.

The following former capabilities are deliberately not migrated:

- GitHub Pull Requests VS Code provider integration;
- GitHub Compare URL generation;
- GitHub fork/topology assumptions;
- PR title/body generation and preview UI;
- Marketplace packaging/release workflows for Codex PR Safe.

The following capabilities do not require migration because their canonical implementations already exist in `codex-safe-core` or the active products:

- semantic context budgeting;
- efficiency planning/token preflight;
- Safe Contract/Codex runtime;
- Review/Commit receipt definitions and validation;
- GitLab MR review publication and durable state in `codex-review-service`.

## Operational migration

Users should uninstall `jiying2007.codex-pr-safe` and use the SCM's native UI/CLI/API for PR/MR creation and metadata. Existing historical releases are unsupported.

Repository history is intentionally kept so the decision is reversible by Git history without carrying a compatibility surface in the active branch.
