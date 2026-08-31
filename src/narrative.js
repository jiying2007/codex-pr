'use strict';
const { truncate, unique } = require('./util');
function inferTitle(commits, max = 100) {
  const subjects = commits.map(c => c.subject).filter(Boolean); if (!subjects.length) return 'chore: deliver change'; if (subjects.length === 1) return truncate(subjects[0], max);
  const first = subjects[0]; const conventional = first.match(/^([a-z]+)(?:\(([^)]+)\))?(!)?:\s+(.+)$/i);
  if (conventional) return truncate(`${conventional[1]}${conventional[2] ? `(${conventional[2]})` : ''}${conventional[3] || ''}: ${conventional[4]} (+${subjects.length - 1} commits)`, max);
  return truncate(`${first} (+${subjects.length - 1} commits)`, max);
}
function changeSignals(changedFiles) {
  const paths = changedFiles.map(f => f.path.toLowerCase()); const signals = [];
  const add = (name, re, level) => { const matches = paths.filter(p => re.test(p)); if (matches.length) signals.push({ name, level, paths: matches.slice(0, 5) }); };
  add('database/schema migration', /(^|\/)(migrations?|schema)(\/|\.|$)/, 'high');
  add('security/authentication', /(^|\/)(security|auth|oauth|permissions?)(\/|\.|$)/, 'high');
  add('delivery/CI infrastructure', /(^|\/)(\.github\/workflows|\.gitlab-ci|deploy|deployment|helm|terraform|dockerfile)/, 'medium');
  add('dependency manifest/lock', /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|requirements.*\.txt|poetry\.lock|go\.sum|cargo\.lock|pom\.xml|gradle.*)/, 'medium');
  add('configuration', /(^|\/)(config|configs|settings)(\/|\.|$)|\.(ya?ml|toml|ini|conf)$/i, 'medium');
  add('public API/header', /(^|\/)(include|api)(\/|$)|\.h(pp)?$/i, 'medium');
  return signals;
}
function classifyChange(changedFiles) {
  const signals = changeSignals(changedFiles); const rank = { low: 0, medium: 1, high: 2 }; let risk = 'low'; for (const s of signals) if (rank[s.level] > rank[risk]) risk = s.level;
  if (changedFiles.length > 100 && rank[risk] < rank.medium) risk = 'medium'; if (changedFiles.length > 500) risk = 'high';
  const roots = unique(changedFiles.map(f => f.path.split('/')[0]).filter(Boolean)).slice(0, 12);
  return { risk, signals, roots, largeChange: changedFiles.length > 100 };
}
function renderSummary({ commits, changedFiles }) {
  const byStatus = changedFiles.reduce((acc, f) => ((acc[f.status] = (acc[f.status] || 0) + 1), acc), {}); const commitLines = commits.slice(0, 12).map(c => `- \`${c.sha.slice(0, 8)}\` ${c.subject}`);
  return [`## Summary`, '', `Deliver ${commits.length} commit${commits.length === 1 ? '' : 's'} across ${changedFiles.length} changed file${changedFiles.length === 1 ? '' : 's'}.`, '', '### Commits', ...commitLines, commits.length > 12 ? `- … ${commits.length - 12} more` : '', '', `### Change shape`, `- Added: ${byStatus.A || 0}`, `- Modified: ${(byStatus.M || 0) + (byStatus.R || 0)}`, `- Deleted: ${byStatus.D || 0}`].filter(Boolean).join('\n');
}
function renderImpact(classification) {
  const lines = ['## Impact & Risk', '', `- Deterministic risk: **${classification.risk.toUpperCase()}**`, `- Top-level areas: ${classification.roots.length ? classification.roots.map(x => `\`${x}\``).join(', ') : 'none'}`];
  if (classification.signals.length) { lines.push('', '### Risk signals'); for (const s of classification.signals) lines.push(`- ${s.level.toUpperCase()} · ${s.name}: ${s.paths.map(x => `\`${x}\``).join(', ')}`); }
  else lines.push('- No path-based high-risk signal detected.');
  return lines.join('\n');
}
function renderVerification(requiredChecks = []) { return ['## Verification', '', '- Codex Change Safe does **not** invent local test execution results.', requiredChecks.length ? `- Required remote checks configured: ${requiredChecks.map(x => `\`${x}\``).join(', ')}` : '- Required checks are discovered from GitHub branch protection when available; GitLab mergeability/pipeline state is checked after the MR exists.', '- Use **Refresh Merge Readiness** for current CI, approvals, discussions, conflicts and provider merge state.'].join('\n'); }
function renderReviewFocus(reviewers, classification) { const lines = ['## Reviewer Focus', '', reviewers.length ? `- Suggested reviewers: ${reviewers.map(x => `@${x}`).join(', ')}` : '- No individual reviewer was deterministically resolved from CODEOWNERS/configuration.']; for (const s of classification.signals.slice(0, 6)) lines.push(`- Inspect ${s.name}: ${s.paths.map(x => `\`${x}\``).join(', ')}`); return lines.join('\n'); }
function renderRollback(classification) { return ['## Rollback', '', '- Default rollback is to revert the merged change using the SCM-native workflow.', classification.signals.some(s => s.name.includes('migration')) ? '- **Migration/schema paths changed:** validate a project-specific forward/rollback plan before merge; a Git revert alone may be insufficient.' : '- No migration path was detected by deterministic path rules; project-specific runtime rollback requirements still take precedence.'].join('\n'); }
function renderEvidence({ receipt, preflight }) {
  const lines = ['## Codex Safe Delivery Evidence', '', `- Preflight: **${preflight.state}**`, `- Head: \`${receipt.headSha}\``, `- Target: \`${receipt.targetBranch}@${receipt.targetSha}\``, `- Merge base: \`${receipt.mergeBase}\``, `- Change Snapshot v${receipt.schemaVersion}: \`${receipt.snapshotFingerprint || receipt.fingerprint}\``];
  if (receipt.provenance) {
    lines.push(`- Provenance: ${receipt.provenance.complete ? 'complete' : 'incomplete'} (${receipt.provenance.reviewReceipts || 0}/${receipt.provenance.totalCommits || 0} review · ${receipt.provenance.commitReceipts || 0}/${receipt.provenance.totalCommits || 0} commit receipts)`);
    if (receipt.provenance.blockedReviewCommits) lines.push(`- Review blockers: **${receipt.provenance.blockedReviewCommits} commit(s)**`);
    if (receipt.provenance.reviewStatus && receipt.provenance.reviewStatus !== 'available') lines.push(`- Review evidence source: ${receipt.provenance.reviewStatus}`);
    if (receipt.provenance.commitStatus && receipt.provenance.commitStatus !== 'available') lines.push(`- Commit evidence source: ${receipt.provenance.commitStatus}`);
  }
  if (preflight.blockers.length) lines.push('', '### Blockers', ...preflight.blockers.map(x => `- ${x.message}`)); if (preflight.warnings.length) lines.push('', '### Warnings', ...preflight.warnings.map(x => `- ${x.message}`)); return lines.join('\n');
}
module.exports = { inferTitle, changeSignals, classifyChange, renderSummary, renderImpact, renderVerification, renderReviewFocus, renderRollback, renderEvidence };
