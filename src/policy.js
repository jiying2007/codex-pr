'use strict';
const POLICY_FILE = '.codex-change-safe.json';
const POLICY_SCHEMA_VERSION = 1;
const PROVENANCE = new Map([
  ['advisory', { review: false, commit: false }],
  ['require-review', { review: true, commit: false }],
  ['require-commit', { review: false, commit: true }],
  ['require-all', { review: true, commit: true }]
]);
function policyError(message) { return Object.assign(new Error(message), { code: 'ECHANGE_POLICY' }); }
function array(value) { return Array.isArray(value) ? value.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim()) : []; }
function unique(values) { return [...new Set(values)]; }
function provenanceValue(value) { return PROVENANCE.get(String(value || 'advisory')) || PROVENANCE.get('advisory'); }
function provenanceName(value) {
  if (value.review && value.commit) return 'require-all';
  if (value.review) return 'require-review';
  if (value.commit) return 'require-commit';
  return 'advisory';
}
function parsePolicy(text) {
  if (!String(text || '').trim()) return {};
  let doc; try { doc = JSON.parse(text); } catch { throw policyError(`${POLICY_FILE} is not valid JSON.`); }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw policyError(`${POLICY_FILE} must contain a JSON object.`);
  const unknownTop = Object.keys(doc).filter(k => !['schemaVersion', 'change'].includes(k));
  if (unknownTop.length) throw policyError(`Unsupported ${POLICY_FILE} top-level keys: ${unknownTop.join(', ')}.`);
  if (doc.schemaVersion !== POLICY_SCHEMA_VERSION) throw policyError(`${POLICY_FILE} schemaVersion must be ${POLICY_SCHEMA_VERSION}.`);
  if (doc.change === undefined) return {};
  if (!doc.change || typeof doc.change !== 'object' || Array.isArray(doc.change)) throw policyError(`${POLICY_FILE}.change must be an object.`);
  const c = doc.change;
  const allowed = new Set(['requiredChecks','requiredApprovals','provenancePolicy','blockOnReviewFindings','requireCleanWorktree','requirePushedHead','requireFreshTarget','reviewers','labels','titlePolicy','managedSections']);
  const unknown = Object.keys(c).filter(k => !allowed.has(k));
  if (unknown.length) throw policyError(`Unsupported ${POLICY_FILE}.change keys: ${unknown.join(', ')}.`);
  if (c.provenancePolicy !== undefined && !PROVENANCE.has(String(c.provenancePolicy))) throw policyError('Invalid change.provenancePolicy.');
  if (c.titlePolicy !== undefined && !['create-only','preserve','managed'].includes(String(c.titlePolicy))) throw policyError('Invalid change.titlePolicy.');
  const approvals = c.requiredApprovals === undefined ? undefined : Number(c.requiredApprovals);
  if (approvals !== undefined && (!Number.isInteger(approvals) || approvals < 0 || approvals > 20)) throw policyError('change.requiredApprovals must be an integer from 0 to 20.');
  for (const key of ['blockOnReviewFindings','requireCleanWorktree','requirePushedHead','requireFreshTarget','managedSections']) {
    if (c[key] !== undefined && typeof c[key] !== 'boolean') throw policyError(`change.${key} must be boolean.`);
  }
  if (c.requiredChecks !== undefined && !Array.isArray(c.requiredChecks)) throw policyError('change.requiredChecks must be an array.');
  if (c.reviewers !== undefined && !Array.isArray(c.reviewers)) throw policyError('change.reviewers must be an array.');
  if (c.labels !== undefined && !Array.isArray(c.labels)) throw policyError('change.labels must be an array.');
  return {
    requiredChecks: array(c.requiredChecks), requiredApprovals: approvals,
    provenancePolicy: c.provenancePolicy === undefined ? undefined : String(c.provenancePolicy),
    blockOnReviewFindings: c.blockOnReviewFindings,
    requireCleanWorktree: c.requireCleanWorktree,
    requirePushedHead: c.requirePushedHead,
    requireFreshTarget: c.requireFreshTarget,
    reviewers: array(c.reviewers), labels: array(c.labels),
    titlePolicy: c.titlePolicy === undefined ? undefined : String(c.titlePolicy),
    managedSections: c.managedSections
  };
}
function tightenBoolean(localValue, committedValue, fallback = true) {
  const local = localValue === undefined ? fallback : Boolean(localValue);
  const committed = committedValue === undefined ? fallback : Boolean(committedValue);
  return local || committed;
}
function mergePolicy(local, committed) {
  const lp = provenanceValue(local.provenancePolicy); const cp = provenanceValue(committed.provenancePolicy);
  const mergedProv = { review: lp.review || cp.review, commit: lp.commit || cp.commit };
  return {
    ...local,
    requiredChecks: unique([...array(committed.requiredChecks), ...array(local.requiredChecks)]),
    requiredApprovals: Math.max(Number(committed.requiredApprovals || 0), Number(local.requiredApprovals || 0)),
    provenancePolicy: provenanceName(mergedProv),
    blockOnReviewFindings: tightenBoolean(local.blockOnReviewFindings, committed.blockOnReviewFindings, true),
    requireCleanWorktree: tightenBoolean(local.requireCleanWorktree, committed.requireCleanWorktree, true),
    requirePushedHead: tightenBoolean(local.requirePushedHead, committed.requirePushedHead, true),
    requireFreshTarget: tightenBoolean(local.requireFreshTarget, committed.requireFreshTarget, true),
    reviewers: unique([...array(committed.reviewers), ...array(local.reviewers)]),
    labels: unique([...array(committed.labels), ...array(local.labels)]),
    titlePolicy: committed.titlePolicy || local.titlePolicy || 'create-only',
    managedSections: committed.managedSections === false ? false : local.managedSections !== false,
    policySource: committed.__present ? 'committed+local-tightening' : 'local',
    committedPolicy: committed.__present ? committed : null
  };
}
async function resolveEffectiveConfig(git, localConfig, targetRef) {
  const text = await git.showFile(targetRef, POLICY_FILE);
  const committed = parsePolicy(text); if (String(text || '').trim()) committed.__present = true;
  return mergePolicy(localConfig, committed);
}
module.exports = { POLICY_FILE, POLICY_SCHEMA_VERSION, parsePolicy, mergePolicy, resolveEffectiveConfig, provenanceValue, provenanceName };
