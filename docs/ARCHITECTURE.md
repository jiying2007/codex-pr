# Architecture

## Domain boundary

Change Safe owns developer-side delivery authorization: topology discovery, committed delivery policy, local/remote snapshot validation, provenance aggregation, PR/MR metadata mutations, native SCM policy discovery, merge readiness and native merge orchestration. Server review, webhook ingestion, durable queues, finding publication and audit remain in `codex-review-service`.

## Authorization pipeline

```text
Local settings (tightening only)
         +
Target-branch .codex-safe.json
         +
SCM-native policy
         ↓
Delivery Preflight
         ↓
Review/Commit provenance
         ↓
Remote PR/MR freshness
         ↓
Provider-specific Merge Readiness
         ↓
Delivery Authorization Gate
```

Unknown policy surfaces and unknown provider merge states never become READY.

## Providers

`GitHubProvider` and `GitLabProvider` own provider-specific API and merge-state semantics. The shared readiness layer only consumes normalized checks, approvals, external status checks, native policy snapshots and a provider classification result.

## Topology

A change has separate source and target remotes/repositories. Both must live on the same SCM instance. GitHub cross-repository PRs namespace the head and bind `head_repo`. GitLab cross-project MRs use the source project endpoint plus `target_project_id` and then operate on the target project where the MR resides.

## Policy

The target tracking ref is the trust root for `.codex-safe.json`. Local settings can add required checks/reviewers/labels, increase approvals or provenance requirements, and enable stricter safety booleans; they cannot weaken committed requirements.

## Evidence

Change Receipt v1 has two fingerprints: a stable pre-delivery snapshot fingerprint and a delivery fingerprint bound to the remote change-request identity. Review and Commit evidence is consumed through public extension API contracts only.
