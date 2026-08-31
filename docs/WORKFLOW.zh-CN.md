# 工作流与授权

1. Review Safe 生成 Review Receipt v4。
2. Commit Safe 生成 Commit Receipt v4。
3. 开发者人工 commit / push。
4. Change Safe 解析 source/target topology 与目标默认分支。
5. 从目标 tracking ref 读取 committed **`.codex-change-safe.json` schema v1** Change Policy。
6. Delivery Preflight 校验 clean/pushed/fresh/merge-base/provenance。
7. Create/Update 只修改 machine-owned Managed Sections；默认不覆盖现有人工 title。
8. Refresh Readiness 合并 GitHub/GitLab 原生 policy、checks、approvals、conflicts、external checks 与 provider merge state。
9. 所有远端 mutation 在 modal confirmation 后重新采集最新证据。
10. Auto-Merge 只允许明确可安全延迟的 WAITING；Merge Queue / Merge Train 仅允许 READY_TO_MERGE。

Safe Core 的 `.codex-safe.json` Policy Schema v3 与 Change Policy 相互独立，Change Safe 不重新解释该文件，因此 Review Safe、Commit Safe、Change Safe 可以在同一仓库同时使用而不会发生 schema 冲突。

5.1.0 实验性的 `.codex-safe.json.change` 布局在 5.1.1 中不提供兼容 fallback；请把其中的 `change` object 显式迁移到 `.codex-change-safe.json`，并设置 `schemaVersion: 1`。
