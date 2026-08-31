# Changelog

## 5.1.0

- unify all remote mutations behind a fresh Delivery Authorization Gate;
- move GitHub/GitLab merge-state semantics into provider-specific fail-closed classifiers;
- add committed `.codex-safe.json` Change Policy with local tightening-only semantics;
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
