## Problem

<!-- What concrete problem or risk does this PR address? -->

## Changes

<!-- Summarize the implementation. -->

## Safety / trust-boundary checklist

- [ ] PR generation remains narrative/provenance-only; provider operations stay outside Safe Core.
- [ ] Base/fork/ref selection remains deterministic and stale local results cannot be published as current.
- [ ] Codex remains read-only, approval-free, capability-probed and isolated from repository prompt injection.
- [ ] Review/Commit evidence accepts only Receipt v4 and validates the canonical provenance contract fail-closed.
- [ ] Family v4 remains pinned to Safe Core 4.0.0 with no legacy Receipt/parser fallback.
- [ ] Release assets remain immutable and include VSIX, SPDX SBOM, SHA256SUMS and provenance attestation.

## Verification

- [ ] `npm run verify:lock`
- [ ] `npm ci --ignore-scripts --no-audit --no-fund`
- [ ] `npm run check`
- [ ] `npm run test:integration`
- [ ] `npm run package`
- [ ] English / Simplified Chinese localization updated when user-visible text changed.

## Compatibility

<!-- Note any VS Code, Git, Codex CLI, provider, receipt/protocol, or migration impact. -->
