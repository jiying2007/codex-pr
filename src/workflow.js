'use strict';
const { runPreflight } = require('./preflight');
const { buildChangeReceipt } = require('./receipt');
const { inferTitle, classifyChange, renderSummary, renderImpact, renderVerification, renderReviewFocus, renderRollback, renderEvidence } = require('./narrative');
const { upsertManagedBody } = require('./managed-sections');
const { parseCodeowners, suggestReviewers } = require('./codeowners');
const { unique } = require('./util');

function applyProvenancePolicy(preflight, provenance, config) {
  if (!provenance) return preflight;
  const blockers = [...preflight.blockers], warnings = [...preflight.warnings];
  const total = preflight.commits.length;
  const reviewComplete = provenance.reviewStatus === 'available' && provenance.reviewReceipts === total && !provenance.incompleteReviewCommits && !provenance.needsEvidenceReviewCommits && !provenance.blockedReviewCommits;
  const commitComplete = provenance.commitStatus === 'available' && provenance.commitReceipts === total;
  if (config.blockOnReviewFindings !== false && provenance.blockedReviewCommits > 0) blockers.push({ code: 'review_provenance_blocked', message: `${provenance.blockedReviewCommits} commit(s) have matching blocking Codex Review Safe evidence.` });
  if (provenance.incompleteReviewCommits > 0) warnings.push({ code: 'review_coverage_incomplete', message: `${provenance.incompleteReviewCommits} matching Review Receipt(s) have incomplete coverage.` });
  if (provenance.needsEvidenceReviewCommits > 0) warnings.push({ code: 'review_evidence_not_ready', message: `${provenance.needsEvidenceReviewCommits} matching Review Receipt(s) still need evidence.` });
  const policy = config.provenancePolicy || 'advisory';
  if ((policy === 'require-review' || policy === 'require-all') && !reviewComplete) blockers.push({ code: 'review_provenance_incomplete', message: `Review provenance is incomplete (${provenance.reviewReceipts}/${total}).` });
  if ((policy === 'require-commit' || policy === 'require-all') && !commitComplete) blockers.push({ code: 'commit_provenance_incomplete', message: `Commit provenance is incomplete (${provenance.commitReceipts}/${total}).` });
  if (policy === 'advisory') {
    if (provenance.reviewStatus === 'available' && !reviewComplete) warnings.push({ code: 'review_provenance_partial', message: `Review provenance covers ${provenance.reviewReceipts}/${total} commits.` });
    if (provenance.commitStatus === 'available' && !commitComplete) warnings.push({ code: 'commit_provenance_partial', message: `Commit provenance covers ${provenance.commitReceipts}/${total} commits.` });
  }
  return { ...preflight, blockers, warnings, state: blockers.length ? 'BLOCKED' : warnings.length ? 'READY_WITH_WARNINGS' : 'READY' };
}

function materializeDelivery({ preflight: rawPreflight, provider, config, existingBody = '', provenance }) {
  const preflight = applyProvenancePolicy(rawPreflight, provenance, config);
  const rules = preflight.codeowners ? parseCodeowners(preflight.codeowners.text) : [];
  const reviewers = suggestReviewers(preflight.changedFiles.map(f => f.path), rules, config.reviewers || []);
  const risk = classifyChange(preflight.changedFiles);
  const receipt = buildChangeReceipt({
    provider: provider.kind,
    repository: preflight.remote.projectPath,
    sourceBranch: preflight.sourceBranch,
    targetBranch: preflight.targetBranch,
    headSha: preflight.headSha,
    targetSha: preflight.targetSha,
    mergeBase: preflight.mergeBase,
    commits: preflight.commits,
    changedFiles: preflight.changedFiles,
    risk,
    provenance,
    preflight
  });
  const title = inferTitle(preflight.commits, 100);
  const sections = {
    summary: renderSummary(preflight),
    impact: renderImpact(risk),
    verification: renderVerification(config.requiredChecks || []),
    review: renderReviewFocus(reviewers, risk),
    rollback: renderRollback(risk)
  };
  if (config.includeReceipt !== false) sections.evidence = renderEvidence({ receipt, preflight });
  const body = config.managedSections === false ? Object.values(sections).join('\n\n') : upsertManagedBody(existingBody, sections);
  return { preflight, receipt, risk, title, body, reviewers, labels: unique(config.labels || []) };
}

async function prepareDelivery({ git, provider, config, existingBody = '', provenance, preflight = null }) {
  const rawPreflight = preflight || await runPreflight({ git, provider, config });
  return materializeDelivery({ preflight: rawPreflight, provider, config, existingBody, provenance });
}

async function createOrUpdateDelivery({ git, provider, config, provenance, expectedHeadSha = '', expectedMergeBase = '' }) {
  const freshPreflight = await runPreflight({ git, provider, config });
  if (expectedHeadSha && freshPreflight.headSha !== expectedHeadSha) throw Object.assign(new Error('HEAD changed after preview/confirmation; run Delivery Preflight again.'), { code: 'ESTALE' });
  if (expectedMergeBase && freshPreflight.mergeBase !== expectedMergeBase) throw Object.assign(new Error('Merge base changed after preview/confirmation; run Delivery Preflight again.'), { code: 'ESTALE' });

  const initial = materializeDelivery({ preflight: freshPreflight, provider, config, provenance });
  if (initial.preflight.state === 'BLOCKED') return { ...initial, action: 'blocked', change: null };

  const existing = await provider.findOpenChangeRequest(initial.preflight.sourceBranch, initial.preflight.targetBranch);
  const prepared = existing && config.managedSections !== false
    ? materializeDelivery({ preflight: freshPreflight, provider, config, existingBody: provider.normalize(existing).body, provenance })
    : initial;

  let change;
  if (existing) {
    const normalized = provider.normalize(existing);
    change = await provider.updateChangeRequest(normalized.number, { title: prepared.title, body: prepared.body });
  } else {
    change = await provider.createChangeRequest({
      sourceBranch: prepared.preflight.sourceBranch,
      targetBranch: prepared.preflight.targetBranch,
      title: prepared.title,
      body: prepared.body,
      draft: config.createAsDraft !== false
    });
  }
  const normalized = provider.normalize(change);
  const remoteWarnings = [];
  if (prepared.labels.length) {
    try { await provider.addLabels(normalized.number, prepared.labels); }
    catch (error) { remoteWarnings.push({ code: 'labels_update_failed', message: `PR/MR was ${existing ? 'updated' : 'created'}, but labels could not be applied: ${error.message}` }); }
  }
  return { ...prepared, action: existing ? 'updated' : 'created', change: normalized, remoteWarnings };
}

module.exports = { prepareDelivery, createOrUpdateDelivery, applyProvenancePolicy, materializeDelivery };
