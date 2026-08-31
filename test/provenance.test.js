'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { normalizeReviewEvidence, normalizeCommitEvidence } = require('../src/provenance');
test('normalizes current family range evidence without guessing receipt internals', () => {
  const review = normalizeReviewEvidence({kind:'codex-review-range-evidence',schemaVersion:4,totalCommits:3,reviewedCommits:2,blockedCommits:1,incompleteCommits:1,needsEvidenceCommits:1,matches:[{commitOid:'a',receipt:{}},{commitOid:'b',receipt:{}}]});
  assert.equal(review.blockedCommits,1); assert.equal(review.incompleteCommits,1); assert.equal(review.reviewedCommits,2);
  const commit = normalizeCommitEvidence({kind:'codex-commit-range-evidence',schemaVersion:4,totalCommits:3,generatedCommits:2,reviewedGeneratedCommits:2,matches:[{commitOid:'a',receipt:{}},{commitOid:'b',receipt:{}}]}); assert.equal(commit.generatedCommits,2);
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
