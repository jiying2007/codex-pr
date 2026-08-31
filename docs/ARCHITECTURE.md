# Architecture

## Domain boundary

Change Safe owns developer-side delivery authorization: source/target topology, local/remote snapshot validation, Review/Commit provenance aggregation, GitHub/GitLab provider behavior, PR/MR metadata mutations, native SCM policy discovery, Merge Readiness and native merge orchestration. Server review, webhook ingestion, durable queues, Finding publication and audit remain in `codex-review-service`.

Safe Core owns the shared deterministic repository-policy contract, canonical JSON and fingerprint primitives. It does not own provider APIs or remote side effects.

## Authorization pipeline

```text
Target-branch .codex-safe.json / Policy Schema v4
                 +
Local settings (tightening only)
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

`GitHubProvider` and `GitLabProvider` own provider-specific API and merge-state semantics. Shared readiness consumes normalized checks, approvals, external status checks, native policy snapshots and a provider classification result.

## Topology

A change has separate source and target remotes/repositories. Both must live on the same SCM instance. GitHub cross-repository PRs namespace the head and bind `head_repo`. GitLab cross-project MRs use the source project endpoint plus `target_project_id` and then operate on the target project where the MR resides.

## Policy

The target tracking ref is the trust root for committed `.codex-safe.json`. Safe Core 4.10.0 / Policy Schema v4 owns parsing, closed validation, the `change` section and committed policy fingerprint.

Change Safe owns only the interpretation/combination step after validation: local settings may add checks/reviewers/labels, increase approvals or provenance requirements and enable stricter safety booleans; they cannot weaken committed requirements. SCM-native requirements are unioned in the Change domain.

There is one repository policy file. Schema v3 and parallel `.codex-change-safe.json` surfaces are intentionally unsupported; there is no compatibility reader.

## Evidence

Change Receipt v1 has two fingerprints: a stable pre-delivery snapshot fingerprint and a delivery fingerprint bound to the remote change-request identity. Review and Commit evidence is consumed through public extension API contracts only.
