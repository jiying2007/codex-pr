# Security

## Trust model

Codex Change Safe runs only in trusted local-file workspaces. Git evidence uses `execFile('git', args)` without a shell. It never performs implicit fetch, pull, push, commit, rebase, or source modification.

## Policy trust

Delivery policy is loaded from committed `.codex-change-safe.json` schema v1 on the target tracking ref. Local settings may tighten requirements but cannot reduce committed required checks, approvals, provenance or safety booleans. Unknown top-level/change keys, wrong schema versions and mistyped safety fields fail closed.

Safe Core's `.codex-safe.json` Policy Schema v3 is a separate trust surface for Review/Commit/Review Service and is never interpreted as Change Policy.

## SCM credentials

Tokens come from environment variables only. Token values are never persisted in settings, receipts, PR/MR bodies, output or logs. API URL userinfo is rejected. API hostname is bound to the Git remote host (`github.com` is specially bound to `api.github.com`). Plain HTTP is denied unless explicitly enabled for a trusted internal instance. Automatic HTTP redirects are disabled so credentials cannot cross an unvalidated hop. Read-only GET requests use bounded retry for transient 429/5xx/network failures; mutations are not automatically replayed.

## Remote mutations

Every user-triggered remote mutation requires modal confirmation and fresh evidence after confirmation. Create/Update, reviewer routing and Mark Ready require a non-blocked fresh Delivery snapshot. Native Auto-Merge also requires a fresh remote readiness result and only accepts explicitly defer-safe waits. GitHub Merge Queue and GitLab Merge Train require READY_TO_MERGE.

## Reporting

Do not place live credentials or private repository contents in public issues. Use private security reporting when available.
