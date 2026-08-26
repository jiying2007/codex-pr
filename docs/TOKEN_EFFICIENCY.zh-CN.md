# Token 效率

Codex PR Safe 统一使用 Codex Safe Core 的效率 Planner。在降低普通低风险变更模型输入量的同时，保持安全边界、stale snapshot 防护和结构化输出校验不变。

PR adapter 对采集到的 diff 做确定性风险评分；Generated/lock 和二进制内容按 metadata-only 处理；低/中风险文本证据在 `maxDiffBytes` 上限内自动缩小；结构化调用执行前做保守 Token preflight；请求估算、实际 Token usage 和耗时写入 provenance metadata。安全、并发、Native 等高风险修改保留完整证据上限。
