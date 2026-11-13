# Workflow and Authorization

Review/Commit receipts are followed by manual commit/push. Change Safe resolves source/target topology and the target default branch, loads committed `change` policy from the target tracking ref's **`.codex-safe.json` Policy Schema v4** through Safe Core 4.18.2, performs Delivery Preflight and provenance validation, creates or updates managed PR/MR sections, then evaluates provider-native merge policy and current readiness.

Review Safe, Commit Safe, Change Safe and Review Service share the same committed `.codex-safe.json` parser/validator and policy fingerprint while consuming separate sections. Change Safe does not define a second Repository Policy schema.

Effective Change policy is:

```text
validated committed .codex-safe.json.change
              ∪
local tightening settings
              ∪
SCM-native requirements
```

Local settings cannot remove committed/native requirements.

Every remote mutation revalidates evidence after confirmation. Native auto-merge may defer only explicitly safe CI/approval waits; GitHub Merge Queue and GitLab Merge Train require `READY_TO_MERGE`.

Policy Schema v4 is a hard cut. Schema v3 and `.codex-change-safe.json` are not read as compatibility fallbacks.

Unreachable GitHub check-run, GitLab approval-state, or GitLab external-status-check APIs are not treated as successful or empty evidence. Refresh Merge Readiness after resolving the provider error; no native auto-merge or queue operation may rely on a partially verified snapshot.
