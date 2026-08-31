# Security

## Trust model

Codex Change Safe runs only in trusted local-file workspaces. Git evidence uses `execFile('git', args)` without a shell. It never performs implicit fetch, pull, push, commit, rebase, or source modification.

## Policy trust

The only repository policy is committed `.codex-safe.json` on the target tracking ref. Safe Core 4.10.0 / Policy Schema v4 owns parsing, closed field/type validation and the committed policy fingerprint. Change Safe consumes only the validated `change` section.

Local settings may tighten requirements but cannot reduce committed required checks, approvals, provenance or safety booleans. Provider-native requirements are unioned later and cannot be weakened locally. Policy Schema v3, unknown fields, wrong types and parallel `.codex-change-safe.json` policy files are unsupported rather than accepted through fallback logic.

## SCM credentials

Tokens come from environment variables only. Token values are never persisted in settings, receipts, PR/MR bodies, output or logs. API URL userinfo is rejected. API hostname is bound to the Git remote host (`github.com` is specially bound to `api.github.com`). Plain HTTP is denied unless explicitly enabled for a trusted internal instance. Automatic HTTP redirects are disabled so credentials cannot cross an unvalidated hop. Read-only GET requests use bounded retry for transient 429/5xx/network failures; mutations are not automatically replayed.

## Remote mutations

Every user-triggered remote mutation requires modal confirmation and fresh evidence after confirmation. Create/Update, reviewer routing and Mark Ready require a non-blocked fresh Delivery snapshot. Native Auto-Merge also requires fresh remote readiness and only accepts explicitly defer-safe waits. GitHub Merge Queue and GitLab Merge Train require `READY_TO_MERGE`.

## Model boundary

Change Safe performs zero model calls by default. Consuming Safe Core Policy/fingerprint primitives does not grant Change Safe Codex runtime authority. The retired Codex PR Safe model-generated narrative surface is not restored.

## Reporting

Do not place live credentials or private repository contents in public issues. Use private security reporting when available.
