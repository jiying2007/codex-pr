# Token efficiency

Codex PR Safe uses the shared Codex Safe Core efficiency planner. PR generation keeps all safety, stale-snapshot and structured-output guarantees while reducing model input for ordinary low-risk changes.

The PR adapter applies deterministic risk scoring to the collected diff, sends generated/lock and binary files as metadata-only semantic context, shrinks low/medium-risk text evidence within the configured `maxDiffBytes` cap, conservatively preflights the structured request, and records request estimate, token usage and duration in provenance metadata. High-risk security/concurrency/native changes retain the full configured evidence cap.
