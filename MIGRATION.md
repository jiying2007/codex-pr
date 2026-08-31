# Migration

## v5.1.0 → v5.1.1 hard cut

Codex Safe Family now uses one committed repository policy: **`.codex-safe.json` Policy Schema v4** from Safe Core 4.10.0.

If a repository used the temporary Change-only policy surface, merge the `change` object into `.codex-safe.json` and set `schemaVersion` to `4`. Do not keep `.codex-change-safe.json`.

```json
{
  "$schema": "https://raw.githubusercontent.com/jiying2007/codex-safe-core/57440a00030941020d5c3e9e01ced3c06062f42e/codex-safe.schema.json",
  "schemaVersion": 4,
  "review": {},
  "commit": {},
  "change": {
    "provenancePolicy": "require-all",
    "requiredChecks": ["build"]
  }
}
```

There is intentionally no compatibility fallback for Policy Schema v3 or `.codex-change-safe.json`. Review, Commit, Change and Review Service must converge on Policy Schema v4 together.

## v5.0 → v5.1 hard cut

The ambiguous `safeCodexChange.remote` setting is removed. Use `safeCodexChange.sourceRemote`, `safeCodexChange.targetRemote` and optional target-branch discovery. No compatibility proxy is kept.

Security-relevant delivery requirements belong in committed `.codex-safe.json.change`. Local settings remain tightening overlays only.

Existing PR/MR human titles are preserved by default (`titlePolicy=create-only`). Use `managed` only when Change Safe should own subsequent title updates.

## v4 → v5 hard cut

Codex PR Safe v4 is retired as the old model-generated PR-description product. Removed rather than migrated: `safeCodexPr.*`, full-diff Codex PR narrative generation, Compare/copy-open primary flow, GitHub-only provider coupling, legacy preview/regenerate semantics and the old Marketplace identity.

The successor product identity is `jiying2007.codex-change-safe`. It is deterministic delivery authorization with zero model calls by default, not a compatibility revival of Codex PR Safe.
