# Token 效率契约

v5 的 Change 阶段默认 **不调用 Codex**。

旧链路会在 Review、Commit、PR Narrative、Server Review 多次重新解释同一 change range。v5 改为：

```text
Review Receipt + Commit Receipt + Git metadata + SCM state
                         ↓
              deterministic manifest
```

因此 Change Safe 本身新增模型输入/输出 Token = **0**。只有 Review Safe / Commit Safe / Review Service 在各自职责内发生模型调用。

Change Safe 不把 Receipt 当“存在即可信”：Range Evidence 仍按真实 first-parent commit、父 HEAD、diff/message fingerprint 重新匹配。
