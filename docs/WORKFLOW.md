# Workflow and gates

Recommended order:

1. Review the staged snapshot with Codex Review Safe.
2. Generate the commit message with Codex Commit Safe.
3. Commit and push manually.
4. Run **Delivery Preflight**.
5. Resolve blockers using normal Git/SCM workflows; Change Safe does not fetch or push implicitly.
6. Confirm **Create / Update PR or MR**.
7. Optionally request deterministic CODEOWNERS reviewers.
8. Refresh Merge Readiness while CI and human review progress.
9. Use the native merge queue / auto-merge path when the gate is ready.

Use `provenancePolicy=require-all` when Review and Commit receipts are mandatory; use `advisory` when Change Safe must remain standalone-capable.
