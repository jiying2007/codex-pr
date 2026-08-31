# Publishing

Codex Change Safe v5 uses the new Marketplace identity `jiying2007.codex-change-safe`; it must not reuse the retired `codex-pr-safe` identity.

GitHub Release publication is automatic when a new package version reaches `main` and passes unit, Extension Host, packaging, checksum, SBOM, and provenance gates. Marketplace publication is a separate explicit workflow and requires repository secret `VSCE_PAT` with permission to publish the `jiying2007` publisher.

The retired Codex PR Safe Marketplace listing should be marked deprecated and point users to Codex Change Safe.
