# Support

Start with **Delivery Preflight**. Common blockers are intentionally actionable:

- `target_ref_missing` / `target_ref_stale`: fetch the configured remote using normal Git, then rerun.
- `head_not_pushed`: push the current branch, then rerun.
- `dirty_worktree`: commit/stash or explicitly relax the policy.
- `provider_incompatible`: upgrade the GitLab instance or use a supported environment.
- `EAPIHOSTMISMATCH`: correct the API base URL; Change Safe will not send a token to an unrelated host.
- `required_check_policy_unknown`: grant read access to branch protection or configure `requiredChecks` explicitly.

For GitLab Self-Managed TLS, prefer a trusted company CA via `NODE_EXTRA_CA_CERTS` instead of disabling HTTPS.
