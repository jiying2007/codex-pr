## 5.4.9

- Make VS Code Marketplace publication manual-only for the current stage; immutable GitHub Release remains the required Family distribution authority, while manual Marketplace publication keeps exact-release verification and receipt generation when explicitly invoked.

# Changelog

## 5.4.8

- Repin to Codex Safe Core 4.16.0 because the shipped Core runtime digest changed to `3ea979b7903eac7740f5357e9346af5741ccb4090c2441146b2e8707642463bd`; publish a new immutable product release and distribution receipt.
- Refresh Product Contract v2 and generated/current-state Family identity for the exact Core pin.

## 5.4.7 - 2026-09-04

- Repin Release Integrity to immutable Core 4.15.0 while preserving the deterministic Change Safe authorization/delivery boundary.
- Reassert defaultModelCalls=0: Change Safe does not consume Model Routing, Machine Registry, Scout, Reviewer, or Adjudicator execution paths.


## 5.4.6

- Repin to Codex Safe Core 4.15.0 as a new immutable product release; no compatibility shim or stale artifact reuse is permitted.
- Refresh generated/current-state Family identity and release evidence for the exact Core pin.

## 5.4.5

- Repin to Codex Safe Core 4.14.4 as a new immutable product release; no compatibility shim or stale artifact reuse is permitted.
- Refresh generated/current-state Family identity and release evidence for the exact Core pin.

## 5.4.4 - 2026-09-03

- Make immutable GitHub Release verification resilient to the bounded attestation-indexing delay by retrying `gh release verify` and each `verify-asset` before failing closed.
- Preserve Change 5.4.3 runtime, 8 MiB streamed SCM response ceiling, GitHub/GitLab provider behavior and zero default model calls unchanged.

## 5.4.3 - 2026-09-03

- Align current product/Core identity documentation with Change 5.4.3 and immutable Core 4.13.1 after the SCM response-bound patch.
- Preserve Change 5.4.2 deterministic delivery behavior, 8 MiB streamed SCM response ceiling and zero default model calls; this patch changes documentation/product identity only.

## 5.4.2 - 2026-09-03

- Repin Codex Change Safe to immutable Codex Safe Core 4.13.1 to restore exact Family trust-root alignment after the structured Codex transcript safety patch.
- Bound every GitHub/GitLab HTTP response body to 8 MiB by streamed bytes, reject oversized `Content-Length` up front, and fail closed with `ESCMOUTPUT` instead of allowing unbounded Extension Host memory growth.
- Add a streamed oversized-response regression; Change remains deterministic with zero default model calls and preserves delivery authorization and receipt semantics.

## 5.4.1 - 2026-09-03

- Repin Codex Change Safe to immutable Codex Safe Core 4.13.0 and consume Runtime/Provider Contract v3 provenance without changing SCM delivery behavior.
- Preserve GitHub/GitLab provider discovery, GitLab 14.6.1+ compatibility, private-LAN HTTP trust rules, zero default model calls, Review Receipt v5 and Commit Receipt v4 consumption unchanged.

## 5.4.0 - 2026-09-02

- Make self-managed GitLab/GHES first-class: credential-free same-host provider discovery, custom ports/relative URL roots, explicit trusted API host aliases, and Doctor diagnostics that work even before provider resolution.
- Support the common SSH-remote + HTTP/private-IP GitLab topology after explicit `allowInsecureHttp` opt-in: probe HTTPS first, fall back to credential-free HTTP discovery, prefer HTTPS when both work, and recognize allowlisted GitLab health probes when the provider is explicit.
- Harden plaintext transport: public IP literals are rejected for HTTP credential delivery, HTTPS remotes cannot downgrade API transport to HTTP, different HTTP(S) source/target origins are treated as different SCM instances, and Preflight visibly warns when tokens traverse plaintext HTTP.
- Harden delivery correctness: NUL-safe Git path parsing, provider-specific CODEOWNERS semantics, explicit SCM/TLS/auth/network error classes, legacy GitLab merge states, and pre/post mutation HEAD binding.
- Fix policy boolean merging so local explicit false is honored unless committed repository policy explicitly tightens it. Surface partial remote warnings instead of silently hiding them.
- Repin Codex Safe Core 4.12.5 and use its local/IANA user-visible timestamp formatter for Output Channel logs while receipts remain canonical UTC.
- Repair current-state documentation identity and restore chronological changelog ordering.

## 5.3.1 - 2026-09-02

- Release-only patch carrying the exact Codex Safe Core 4.12.4 family pin and validated delivery contracts; no Change Safe runtime or delivery semantics change.

## 5.3.0 - 2026-09-01

- Align Change Safe with Codex Safe Core 4.12 Provider Contract v2 while keeping zero default model calls and deterministic delivery authorization.

## 5.2.0

- Adopt immutable Safe Core 4.11.0 and Review Receipt v5 qualification semantics.
- Make require-review/require-all depend on Review coverage, mechanical and quality gates rather than the Review-only needs_evidence readiness state.
- Keep blocked/incomplete/mechanical-fail Review evidence fail closed while Change retains merge-readiness authority.
- Verify immutable GitHub Release provenance and every VSIX/SBOM/checksum asset inside the release workflow.

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
