# Workflow and Authorization

Review/Commit receipts are followed by manual commit/push. Change Safe resolves source/target topology and default target, loads committed Change Policy from **`.codex-change-safe.json` schema v1** on the target tracking ref, performs Delivery Preflight and provenance validation, creates or updates managed PR/MR sections, and then evaluates provider-native merge policy and current readiness.

Safe Core's `.codex-safe.json` Policy Schema v3 remains independent and is not interpreted as Change Policy. This lets Review Safe, Commit Safe and Change Safe coexist in one repository without schema collision.

Every remote mutation revalidates evidence after confirmation. Native auto-merge may defer only explicitly safe CI/approval waits; GitHub Merge Queue and GitLab Merge Train require READY_TO_MERGE. The 5.1.0 experimental `.codex-safe.json.change` layout has no compatibility fallback in 5.1.1; move its `change` object to `.codex-change-safe.json` and set `schemaVersion` to `1`.
