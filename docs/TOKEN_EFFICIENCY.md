# Token efficiency contract

Codex Change Safe performs **zero model calls by default**. It composes validated Review/Commit range evidence, Git metadata, and SCM state instead of sending the same `base...HEAD` diff to a model again.

Receipt existence is not trusted by itself: the producing products re-resolve range evidence against real first-parent commits and fingerprints before Change Safe consumes it.
