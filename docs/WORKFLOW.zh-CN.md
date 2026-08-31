# 工作流与门禁

推荐顺序：

1. Codex Review Safe 审查 staged snapshot。
2. Codex Commit Safe 生成并绑定 Commit Receipt。
3. 人工 commit、push。
4. 运行 **Delivery Preflight**。
5. 处理 `BLOCKED` 项；Change Safe 不自动 fetch/push 修复。
6. **Create / Update PR or MR**，确认远端写操作。
7. **Request Suggested Reviewers**（可选）。
8. CI/人工 Review 进行中使用 **Refresh Merge Readiness**。
9. `READY_TO_MERGE` 后使用 SCM 原生 Merge Queue / Auto-Merge。

`provenancePolicy=require-all` 适合希望把 Review Safe + Commit Safe 变成正式本地交付门禁的仓库；`advisory` 允许 Change Safe 独立使用。
