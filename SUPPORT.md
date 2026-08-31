# Support

Run **Codex Change Safe: Check Environment / Doctor** first. It reports only redacted operational facts: Git version, provider host, source/target repository topology, default branch, provider version/capability, token presence, Review/Commit extension API compatibility and policy source.

The `Codex Change Safe` Output Channel logs operation id, action, duration, provider/gate codes and errors without tokens, source content, diffs or PR/MR bodies.

For GitLab Self-Managed, verify HTTPS/private CA setup (`NODE_EXTRA_CA_CERTS` preferred), API token scope, source/target remotes, target tracking ref freshness and the instance version. For reproducible reports include version, provider, error code and sanitized topology only.
