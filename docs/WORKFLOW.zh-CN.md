# 工作流与授权

1. Review Safe 生成 Review Receipt v4。
2. Commit Safe 生成 Commit Receipt v4。
3. 开发者人工 commit / push。
4. Change Safe 解析 source/target topology 与目标默认分支。
5. 从目标 tracking ref 读取 committed `.codex-safe.json` Change Policy。
6. Delivery Preflight 校验 clean/pushed/fresh/merge-base/provenance。
7. Create/Update 只修改 machine-owned Managed Sections；默认不覆盖现有人工 title。
8. Refresh Readiness 合并 GitHub/GitLab 原生 policy、checks、approvals、conflicts、external checks 与 provider merge state。
9. 所有远端 mutation 在 modal confirmation 后重新采集最新证据。
10. Auto-Merge 只允许明确可安全延迟的 WAITING；Merge Queue / Merge Train 仅允许 READY_TO_MERGE。
