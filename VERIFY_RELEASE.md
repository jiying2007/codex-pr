# Verify Codex Change Safe Release

1. Confirm the Git tag resolves to the GitHub Verified release commit.
2. Download `codex-change-safe-<version>.vsix`, `SBOM.spdx.json`, and `SHA256SUMS` from the immutable GitHub Release.
3. Run `sha256sum -c SHA256SUMS`.
4. Inspect the VSIX and confirm `extension/dist/extension.js` exists while `src/`, `test/`, `scripts/`, and `package-lock.json` are absent.
5. Verify the GitHub build provenance attestation for the VSIX/SBOM/checksum artifacts.

The v4 `codex-pr-safe` artifacts are historical and are not valid v5 Change Safe packages.
