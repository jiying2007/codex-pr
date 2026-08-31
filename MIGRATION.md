# Migration

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

Move security-relevant delivery requirements from per-user VS Code settings into committed target-branch `.codex-safe.json` `change` policy. Local settings remain available only as tightening overlays.

Existing PR/MR human titles are preserved by default (`titlePolicy=create-only`). Set `managed` only when Change Safe should own subsequent title updates.

## v4 → v5 hard cut

Codex PR Safe v4 is retired. Removed rather than migrated: `safeCodexPr.*`, full-diff Codex PR narrative generation, Compare/copy-open primary flow, GitHub-only provider coupling, legacy preview/regenerate semantics and the old Marketplace identity.

New product identity: `jiying2007.codex-change-safe`. The historical `jiying2007.codex-pr-safe` listing should remain deprecated/retired and point users to Change Safe.
