# GitLab Self-Managed

GitLab Self-Managed is a first-class provider. Minimum supported version: **14.6.1**. Preflight probes `/api/v4/version` and blocks versions below the compatibility floor.

For internal CAs, keep HTTPS and configure `NODE_EXTRA_CA_CERTS`. The API host must match the Git remote host; GitLab tokens are never sent through an unrelated relay.

Draft MRs use the broadly compatible `Draft:` title prefix. GitLab 17.11+ uses `auto_merge=true`; older supported profiles use `merge_when_pipeline_succeeds=true`. Readiness prefers pipeline jobs, falls back to pipeline state, and consumes approval rules when exposed by the instance/license.
