'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { normalizeReviewEvidence, normalizeCommitEvidence } = require('../src/provenance');

function receipt(overrides={}) { return { coverageVerdict:'complete', mechanicalGate:'pass', qualityVerdict:'no_findings', readinessVerdict:'needs_evidence', ...overrides }; }

test('review provenance qualification is based on quality coverage and mechanical gates', () => {
  const review = normalizeReviewEvidence({kind:'codex-review-range-evidence',schemaVersion:5,totalCommits:3,reviewedCommits:3,matches:[
    {commitOid:'a',receipt:receipt()},
    {commitOid:'b',receipt:receipt({qualityVerdict:'findings_open'})},
    {commitOid:'c',receipt:receipt({coverageVerdict:'incomplete'})}
  ]});
  assert.equal(review.reviewedCommits,3);
  assert.equal(review.qualifiedCommits,2);
  assert.equal(review.incompleteCommits,1);
  assert.equal(review.unqualifiedCommits,1);
  assert.equal(review.blockedCommits,0);
});

test('needs_evidence readiness does not make an otherwise clean review unqualified', () => {
  const review = normalizeReviewEvidence({kind:'codex-review-range-evidence',schemaVersion:5,totalCommits:1,reviewedCommits:1,matches:[{commitOid:'a',receipt:receipt({readinessVerdict:'needs_evidence'})}]});
  assert.equal(review.qualifiedCommits,1);
  assert.equal(review.unqualifiedCommits,0);
});

test('blocked quality and mechanical failures fail closed', () => {
  const review = normalizeReviewEvidence({kind:'codex-review-range-evidence',schemaVersion:5,totalCommits:2,reviewedCommits:2,matches:[
    {commitOid:'a',receipt:receipt({qualityVerdict:'blocked'})},
    {commitOid:'b',receipt:receipt({mechanicalGate:'fail'})}
  ]});
  assert.equal(review.qualifiedCommits,0);
  assert.equal(review.blockedCommits,1);
  assert.equal(review.mechanicalFailureCommits,1);
});

test('normalizes commit range evidence', () => {
  const commit = normalizeCommitEvidence({kind:'codex-commit-range-evidence',schemaVersion:4,totalCommits:3,generatedCommits:2,reviewedGeneratedCommits:2,matches:[{commitOid:'a',receipt:{}},{commitOid:'b',receipt:{}}]});
  assert.equal(commit.generatedCommits,2);
});

test('provenance public API contracts fail closed when an installed extension is too old', async () => {
  const { collectProvenance } = require('../src/provenance');
  const vscode = { extensions: { getExtension(id) {
    if (id.includes('review')) return { isActive: true, exports: { contractVersion: 1, async getReviewEvidenceForRange(){ throw new Error('must not call old review API'); } } };
    return { isActive: true, exports: { contractVersion: 0, async getCommitEvidenceForRange(){ throw new Error('must not call old commit API'); } } };
  } } };
  const result = await collectProvenance(vscode, '/repo', 'origin/main', 'HEAD');
  assert.equal(result.reviewStatus, 'unsupported');
  assert.equal(result.commitStatus, 'unsupported');
  assert.equal(result.complete, false);
});
