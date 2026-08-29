# Codex PR Safe — 已退役

[English](README.md) | [简体中文](README.zh-CN.md)

本仓库已经退役，不再属于活跃的 Codex Safe 产品。

原 VS Code 扩展的职责是基于已提交的 `base...HEAD` 变更生成 Pull Request 标题/正文，并集成 GitHub Pull Requests。经过产品边界收敛，这一职责不足以继续作为独立产品存在，而且会与现有开发、审查链路重复读取和解释同一份变更。

## 当前产品边界

活跃产品族明确收敛为：

- [`codex-safe-core`](https://github.com/jiying2007/codex-safe-core)：共享安全、运行时、证据与上下文能力。
- [`codex-review`](https://github.com/jiying2007/codex-review)：开发者侧提交前审查。
- [`codex-commit`](https://github.com/jiying2007/codex-commit)：开发者侧 Commit Message 生成。
- [`codex-review-service`](https://github.com/jiying2007/codex-review-service)：服务端 GitLab Self-Managed Merge Request 审查、发布、门禁与审计。

不会提供新的 PR/MR 描述生成器。`codex-commit` 明确**不**增加 PR/MR 描述生成功能。PR/MR 创建和元数据管理交给 SCM 原生 UI、CLI 或 API。

## 退役策略

- 不再新增功能、修复、发布或 Marketplace 上架。
- 不保留兼容代理，也不创建替代 VS Code 扩展。
- 历史 Commit/Tag/Release 仅作为历史记录，不再属于当前 Family Contract。
- 原有 GitHub Provider、Compare URL、Fork Topology 等 GitHub 专属逻辑不迁入 `codex-safe-core`。
- Semantic Context、Efficiency Planner 等真正共享的能力已经存在于 `codex-safe-core`，无需从本仓库重复迁移。

架构决策和迁移说明见 [`RETIRED.md`](RETIRED.md)。
