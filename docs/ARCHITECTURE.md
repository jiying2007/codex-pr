# Architecture

## Product boundary

Codex Change Safe owns the developer-side `commit → PR/MR → merge-ready` transition. It does not review source code on the server and does not own SCM webhooks or durable publication.

```text
local Git snapshot
      │
      ├─ Review Safe public range-evidence API
      ├─ Commit Safe public range-evidence API
      │
      ▼
Delivery Preflight ──fail closed──► blockers/warnings
      │
      ▼
Change Manifest + Change Receipt v1
      │
      ▼
ChangeRequestProvider
      ├─ GitHubProvider
      └─ GitLabProvider
      │
      ▼
PR/MR → checks/approvals/conflicts → Ready-to-Merge
```

## Domains

1. `remote.js` — parse Git remotes and fail-closed provider detection.
2. `git-cli.js` — read-only Git evidence; no shell and no implicit network mutation.
3. `preflight.js` — source/target/merge-base/push/freshness checks.
4. `provenance.js` — consumes public Review/Commit extension APIs; never reads another extension's private state.
5. `narrative.js` — deterministic Change Manifest and path-based risk signals; no model invocation.
6. `managed-sections.js` — machine-owned PR/MR regions that preserve human prose.
7. `providers/*` — SCM-specific REST/GraphQL adapters behind one Change Request domain.
8. `readiness.js` — deterministic `BLOCKED / WAITING / READY_TO_MERGE` gate.
9. `receipt.js` — immutable Change Receipt v1 fingerprint; finalized with remote PR/MR identity.
10. `delivery-tree.js` — persistent Source Control surface.

## Fail-closed rules

- custom SCM host cannot be guessed;
- API token destination must match the Git remote host;
- pagination exhaustion is required for PR/MR/review/job scans;
- stale source HEAD or target tracking evidence blocks delivery;
- unknown required-check policy is not silently treated as passing;
- GitHub merge queue enqueue requires `READY_TO_MERGE`;
- writes require explicit user confirmation.
