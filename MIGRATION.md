# Migration

## v5.1.0 → v5.1.1 hard cut

Change Safe no longer overloads Safe Core's `.codex-safe.json` repository policy. Move delivery policy to the product-owned **`.codex-change-safe.json`** file and use `schemaVersion: 1`.

Before:

```json
{
  "schemaVersion": 4,
  "change": {
    "provenancePolicy": "require-all",
    "requiredChecks": ["build"]
  }
}
```

After, in `.codex-change-safe.json`:

```json
{
  "schemaVersion": 1,
  "change": {
    "provenancePolicy": "require-all",
    "requiredChecks": ["build"]
  }
}
```

There is intentionally no compatibility fallback. Safe Core/Review/Commit keep `.codex-safe.json` Policy Schema v3; Change Safe owns `.codex-change-safe.json` so both policy surfaces can coexist in the same repository without invalidating each other.

## v5.0 → v5.1 hard cut

The ambiguous `safeCodexChange.remote` setting is removed. Use:

```json
{
  "safeCodexChange.sourceRemote": "origin",
  "safeCodexChange.targetRemote": "upstream",
  "safeCodexChange.targetBranch": ""
}
```

An empty `targetRemote` uses `sourceRemote`; an empty `targetBranch` discovers the target repository default branch. No compatibility proxy is kept.

Security-relevant delivery requirements belong in committed target-branch `.codex-change-safe.json` Change Policy. Local settings remain available only as tightening overlays.

Existing PR/MR human titles are preserved by default (`titlePolicy=create-only`). Set `managed` only when Change Safe should own subsequent title updates.

## v4 → v5 hard cut

Codex PR Safe v4 is retired. Removed rather than migrated: `safeCodexPr.*`, full-diff Codex PR narrative generation, Compare/copy-open primary flow, GitHub-only provider coupling, legacy preview/regenerate semantics and the old Marketplace identity.

New product identity: `jiying2007.codex-change-safe`. The historical `jiying2007.codex-pr-safe` listing should remain deprecated/retired and point users to Change Safe.
