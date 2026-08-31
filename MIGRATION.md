# v4 → v5 hard cut

Codex PR Safe v4 is retired. Codex Change Safe v5 is a new product boundary in the same repository history.

Removed rather than migrated:

- `safeCodexPr.*` settings and command IDs;
- Codex-based full-diff PR narrative generation;
- GitHub Compare URL / copy-and-open primary flow;
- GitHub Pull Requests provider coupling;
- GitHub-only fork/topology assumptions;
- legacy preview/webview and regenerate semantics.

New namespace: `safeCodexChange.*`.

No compatibility proxy is provided. Users of the historical extension should uninstall `jiying2007.codex-pr-safe`; a future Marketplace publication of v5 should use the new product identity `jiying2007.codex-change-safe`.
