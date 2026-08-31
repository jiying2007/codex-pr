# Changelog

## 5.1.3

- Align the primary VS Code SCM toolbar with the Family UI Contract: Create / Update PR or MR is the single `navigation@7` Change action after Review and Commit.
- Delivery Preflight remains available in the Change view and command surface, but no longer occupies the primary SCM toolbar.
- Repin to immutable Safe Core 4.10.2; default model calls remain zero.

## 5.1.2

- repin the exact immutable Safe Core 4.10.1 release that fixes active Change Product Contract verification;
- keep Safe Contract v2, Policy Schema v4, Change Receipt v1 and zero default model calls unchanged.

## 5.1.1

- align English/简体中文 README navigation and top-level documentation structure with Codex Review Safe / Codex Commit Safe;
- document the canonical Family workflow with Codex Change Safe as the delivery stage;
- hard-cut committed Change Policy from the conflicting `.codex-safe.json.change` experiment to product-owned `.codex-change-safe.json` schema v1;
- preserve Safe Core `.codex-safe.json` Policy Schema v3 unchanged so Review Safe, Commit Safe and Change Safe can coexist in one repository;
- reject missing/wrong Change Policy schema, unknown top-level keys and mistyped safety fields fail-closed;
- keep product identity, provider support, safety guarantees and release verification visible in the same family layout.

## 5.1.0

- unify all remote mutations behind a fresh Delivery Authorization Gate;
- move GitHub/GitLab merge-state semantics into provider-specific fail-closed classifiers;
- introduce committed Change Policy with local tightening-only semantics (the 5.1.0 `.codex-safe.json.change` layout is superseded by 5.1.1);
- union native SCM policy with committed/local required checks and approvals;
- preserve GitHub required-check integration/app identity;
- add source/target remote topology, GitHub fork and GitLab cross-project MR support;
- discover target repository default branch instead of hard-coding `main`;
- add GitLab External Status Checks and Merge Train integration;
- preserve CODEOWNERS team owners and explicit GitLab team-to-user mapping support;
- reject malformed/duplicate Managed Section markers and preserve existing titles by default;
- add Doctor/redacted diagnostics, redirect-safe HTTP and bounded GET retries;
- add real VS Code Extension Host and GitLab CE provider matrices;
- restore product-grade VSIX/SBOM/checksum/provenance GitHub Release pipeline and separate new-identity Marketplace publication.

## 5.0.0

Rebuilt retired Codex PR Safe as Codex Change Safe: deterministic GitHub/GitLab delivery preflight, provenance, managed sections, merge readiness and Change Receipt v1 with zero default model calls.
