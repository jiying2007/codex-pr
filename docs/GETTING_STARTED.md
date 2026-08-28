# Getting Started with Codex PR Safe

## 1. Prerequisites

Install VS Code 1.90+, Git and OpenAI Codex CLI in the environment hosting the workspace Extension Host:

```bash
codex --version
```

For the built-in OpenAI provider, authenticate Codex there as usual:

```bash
codex login
```

Remote SSH, Dev Containers, Codespaces and WSL require Codex inside the remote environment. The Codex executable and provider credentials must be visible to the workspace Extension Host.

## 2. Install the extension

Install `jiying2007.codex-pr-safe` from the VS Code Marketplace or an immutable GitHub Release VSIX.

## 3. Use an OpenAI-compatible relay

Codex PR Safe intentionally runs Codex with `--ignore-user-config`, so it does not inherit relay/provider settings from `~/.codex/config.toml`. Normal terminal Codex may keep using that file, but PR Safe requires explicit provider settings.

Configure VS Code User Settings JSON:

```json
{
  "safeCodexPr.providerMode": "openai-compatible",
  "safeCodexPr.providerBaseUrl": "https://relay.example.com/v1",
  "safeCodexPr.providerApiKeyEnv": "CODEX_RELAY_API_KEY",
  "safeCodexPr.model": "gpt-5.2"
}
```

Requirements:

- `providerBaseUrl` must be an HTTPS base URL without embedded credentials, query parameters or fragments;
- `providerApiKeyEnv` is the environment-variable name, not the API key value;
- the relay must implement the OpenAI Responses API (`/v1/responses`) with SSE/Structured Output compatibility; `/v1/chat/completions` alone is not sufficient;
- compatible providers use Responses HTTP/SSE and do not use WebSocket transport;
- set `safeCodexPr.model` explicitly when the relay exposes a custom model alias.

### Make the key visible to the Extension Host

Linux/macOS:

```bash
export CODEX_RELAY_API_KEY="sk-xxxx"
code .
```

Windows PowerShell:

```powershell
$env:CODEX_RELAY_API_KEY="sk-xxxx"
code .
```

Exporting a variable only inside an already-open integrated terminal does not update the running Extension Host. Fully exit VS Code and restart it from an environment that already contains the key.

For Remote SSH, WSL, Dev Containers and Codespaces, configure the key in the remote Extension Host environment.

## 4. Check the environment

Open a trusted Git workspace and run **Codex PR Safe: Check Codex Environment**.

The current check performs a minimal structured model round-trip through the exact PR Safe Runtime/provider configuration instead of only checking the executable. Treat the environment as ready only when this check succeeds.

## 5. Prepare a PR range

PR Safe uses committed changes only.

```bash
git status --short
git rev-list --count origin/main..HEAD
git log --oneline origin/main..HEAD
```

Replace `origin/main` with the intended Base. If the count is zero, there is no committed PR range yet.

## 6. Generate the PR draft

Run **Generate PR**, review/edit the local preview, then copy title/body or open GitHub Compare. Final submission is manual.

## Common problems

### Terminal Codex works, but relay-backed PR Safe fails

Do not rely only on `~/.codex/config.toml`. Verify `safeCodexPr.providerMode=openai-compatible`, `providerBaseUrl`, `providerApiKeyEnv`, confirm that the key is visible to the Extension Host, then rerun **Check Codex Environment**.

### Logs still show `api.openai.com`

Relay mode should not fall back to the built-in OpenAI endpoint. Recheck the provider settings and Extension Host environment, restart VS Code and rerun the environment check instead of only raising timeout values.

### Relay supports Chat Completions only

The compatible provider requires the Responses API. A relay exposing only `/v1/chat/completions` needs a Responses-compatible layer first.

### `ENOCHANGES`

Run:

```bash
git status --short
git rev-list --count <base>..HEAD
```

- count `0` + modified files in `git status`: changes are uncommitted; commit them first;
- count `0` + clean worktree: current branch has no commits ahead of Base;
- count > `0`: verify the selected Base is correct and inspect `git diff --stat <base>...HEAD`.

PR Safe intentionally does not include working-tree-only changes.

### Wrong Base

Run **Select Base and Generate** or configure `safeCodexPr.baseBranch`. PR Safe does not fetch automatically.

### Codex executable not found

Run `codex --version` in the same local/remote environment as the workspace and configure `safeCodexPr.codexPath` if required.

### Current branch is not published

Generation can still work locally. To open a valid GitHub Compare page, push the branch yourself first; PR Safe never pushes for you.

### Stale preview

If HEAD, current branch or Base changes after generation, regenerate before copying/opening.

## Upgrade

Upgrade from Marketplace or install a newer immutable VSIX, reload VS Code and run **Check Codex Environment** before the first generation.
