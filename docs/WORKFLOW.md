# Workflow and Authorization

Review/Commit receipts are followed by manual commit/push. Change Safe resolves source/target topology and default target, loads committed Change Policy from the target tracking ref, performs Delivery Preflight and provenance validation, creates or updates managed PR/MR sections, and then evaluates provider-native merge policy and current readiness. Every remote mutation revalidates evidence after confirmation. Native auto-merge may defer only explicitly safe CI/approval waits; GitHub Merge Queue and GitLab Merge Train require READY_TO_MERGE.
