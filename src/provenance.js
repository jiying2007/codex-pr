'use strict';

const { reviewReceiptQualifiesForDelivery } = require('./codex-safe-core/judgment-lifecycle');

const REVIEW_EXTENSION_ID = 'jiying2007.codex-review-safe';
const COMMIT_EXTENSION_ID = 'jiying2007.codex-commit-safe';
const REVIEW_API_CONTRACT = 2;
const COMMIT_API_CONTRACT = 1;

function emptyReview(status = 'unavailable') {
  return Object.freeze({ status, totalCommits: 0, reviewedCommits: 0, blockedCommits: 0, qualifiedCommits: 0, matches: [] });
}
function emptyCommit(status = 'unavailable') {
  return Object.freeze({ status, totalCommits: 0, generatedCommits: 0, reviewedGeneratedCommits: 0, matches: [] });
}
function normalizeReviewEvidence(value) {
  if (!value || value.kind !== 'codex-review-range-evidence' || !Array.isArray(value.matches)) return emptyReview('invalid');
  const matches = value.matches.filter(item => typeof item?.commitOid === 'string' && item.commitOid && item.receipt);
  const qualifiedCommits = matches.filter(item => reviewReceiptQualifiesForDelivery(item.receipt)).length;
  return Object.freeze({
    status: 'available',
    schemaVersion: value.schemaVersion,
    totalCommits: Number(value.totalCommits) || 0,
    reviewedCommits: Number(value.reviewedCommits ?? matches.length) || 0,
    blockedCommits: matches.filter(item => item.receipt.qualityVerdict === 'blocked').length,
    incompleteCommits: matches.filter(item => item.receipt.coverageVerdict !== 'complete').length,
    mechanicalFailureCommits: matches.filter(item => item.receipt.mechanicalGate === 'fail').length,
    qualifiedCommits,
    unqualifiedCommits: Math.max(0, (Number(value.totalCommits) || 0) - qualifiedCommits),
    matches
  });
}
function normalizeCommitEvidence(value) {
  if (!value || value.kind !== 'codex-commit-range-evidence' || !Array.isArray(value.matches)) return emptyCommit('invalid');
  const matches = value.matches.filter(item => typeof item?.commitOid === 'string' && item.commitOid);
  return Object.freeze({
    status: 'available',
    schemaVersion: value.schemaVersion,
    totalCommits: Number(value.totalCommits) || 0,
    generatedCommits: Number(value.generatedCommits ?? matches.length) || 0,
    reviewedGeneratedCommits: Number(value.reviewedGeneratedCommits) || 0,
    matches
  });
}
async function activateExtension(vscode, id) {
  const extension = vscode.extensions.getExtension(id);
  if (!extension) return null;
  return extension.isActive ? extension.exports : extension.activate();
}
async function collectProvenance(vscode, repoRoot, baseRef, headRef = 'HEAD', token) {
  let review = emptyReview(), commit = emptyCommit();
  try {
    const api = await activateExtension(vscode, REVIEW_EXTENSION_ID);
    if (api && Number(api.contractVersion) >= REVIEW_API_CONTRACT && typeof api.getReviewEvidenceForRange === 'function') review = normalizeReviewEvidence(await api.getReviewEvidenceForRange(repoRoot, baseRef, headRef, token));
    else if (api) review = emptyReview('unsupported');
  } catch (error) {
    if (error?.code === 'ECANCELLED') throw error;
    review = emptyReview('error');
  }
  try {
    const api = await activateExtension(vscode, COMMIT_EXTENSION_ID);
    if (api && Number(api.contractVersion) >= COMMIT_API_CONTRACT && typeof api.getCommitEvidenceForRange === 'function') commit = normalizeCommitEvidence(await api.getCommitEvidenceForRange(repoRoot, baseRef, headRef, token));
    else if (api) commit = emptyCommit('unsupported');
  } catch (error) {
    if (error?.code === 'ECANCELLED') throw error;
    commit = emptyCommit('error');
  }
  const totalCommits = Math.max(review.totalCommits || 0, commit.totalCommits || 0);
  const complete = totalCommits > 0 && review.status === 'available' && commit.status === 'available' && review.reviewedCommits === totalCommits && review.qualifiedCommits === totalCommits && commit.generatedCommits === totalCommits;
  return Object.freeze({
    complete,
    totalCommits,
    reviewReceipts: review.reviewedCommits,
    qualifiedReviewReceipts: review.qualifiedCommits,
    commitReceipts: commit.generatedCommits,
    reviewedGeneratedCommits: commit.reviewedGeneratedCommits,
    blockedReviewCommits: review.blockedCommits || 0,
    incompleteReviewCommits: review.incompleteCommits || 0,
    mechanicalFailureReviewCommits: review.mechanicalFailureCommits || 0,
    needsEvidenceReviewCommits: review.unqualifiedCommits || 0,
    reviewStatus: review.status,
    commitStatus: commit.status,
    review,
    commit
  });
}
module.exports = { REVIEW_EXTENSION_ID, COMMIT_EXTENSION_ID, REVIEW_API_CONTRACT, COMMIT_API_CONTRACT, normalizeReviewEvidence, normalizeCommitEvidence, collectProvenance };
