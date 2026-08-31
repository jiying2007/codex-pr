'use strict';
const { sha256, stableJson } = require('./util');
const CHANGE_RECEIPT_VERSION = 1;

function fingerprintCanonical(receipt, excluded = []) {
  const canonical = { ...receipt };
  for (const key of ['createdAt', 'updatedAt', 'fingerprint', 'snapshotFingerprint', 'deliveryFingerprint', ...excluded]) delete canonical[key];
  return sha256(stableJson(canonical));
}

function buildChangeReceipt(input) {
  const receipt = {
    schemaVersion: CHANGE_RECEIPT_VERSION,
    kind: 'codex-change-safe',
    createdAt: new Date().toISOString(),
    provider: input.provider,
    repository: input.repository,
    sourceBranch: input.sourceBranch,
    targetBranch: input.targetBranch,
    headSha: input.headSha,
    targetSha: input.targetSha,
    mergeBase: input.mergeBase,
    commitCount: input.commits.length,
    commits: input.commits.map(c => ({ sha: c.sha, subject: c.subject })),
    changedFiles: input.changedFiles.map(f => ({ path: f.path, status: f.status })),
    risk: input.risk || { risk: 'unknown', signals: [] },
    provenance: input.provenance || { reviewReceipts: 0, commitReceipts: 0, complete: false },
    preflight: {
      state: input.preflight.state,
      blockers: input.preflight.blockers.map(b => b.code),
      warnings: input.preflight.warnings.map(w => w.code)
    }
  };
  const snapshotFingerprint = fingerprintCanonical(receipt);
  return { ...receipt, snapshotFingerprint, fingerprint: snapshotFingerprint };
}

function finalizeChangeReceipt(receipt, change, action = 'updated') {
  const finalReceipt = {
    ...receipt,
    updatedAt: new Date().toISOString(),
    action,
    changeRequest: {
      provider: change.provider,
      number: change.number,
      id: change.id,
      url: change.url,
      headSha: change.headSha,
      sourceBranch: change.sourceBranch,
      targetBranch: change.targetBranch
    }
  };
  const deliveryFingerprint = fingerprintCanonical(finalReceipt);
  // The snapshot fingerprint is intentionally stable and is the value published in the
  // managed PR/MR body. The delivery fingerprint additionally binds the remote identity.
  return { ...finalReceipt, fingerprint: receipt.snapshotFingerprint || receipt.fingerprint, deliveryFingerprint };
}

module.exports = { CHANGE_RECEIPT_VERSION, buildChangeReceipt, finalizeChangeReceipt, fingerprintCanonical };
