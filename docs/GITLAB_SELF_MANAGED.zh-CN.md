# GitLab Self-Managed

支持 GitLab 14.6.1+，并在真实 GitLab CE 14.6.1 / 17.11.7 / 19.3.0 CI 矩阵运行 Provider contract。

- 17.11+ auto-merge 使用 `auto_merge`；更早版本使用 `merge_when_pipeline_succeeds`。
- `detailed_merge_status` 使用 Provider 专属 fail-closed 状态机；`conflict` 等阻断状态不会误判为 READY，未知未来状态默认为 WAITING。
- Pipeline job 区分 blocking manual 与 `allow_failure` optional manual。
- Ultimate External Status Checks 可进入 Merge Readiness；不可用时 capability-aware 回退，不伪造支持。
- Premium/Ultimate 可使用 Merge Train，调用绑定当前 head SHA。
- Fork/跨项目 MR 使用 source / target remote 拓扑与 `target_project_id`。
- 私有 CA 推荐 `NODE_EXTRA_CA_CERTS`；HTTP 默认拒绝。所有 SCM HTTP redirect 均禁用。
