'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { buildChangeReceipt, finalizeChangeReceipt } = require('../src/receipt');
function input() { return { provider:'github', repository:'o/r', sourceBranch:'feat', targetBranch:'main', headSha:'h', targetSha:'t', mergeBase:'b', commits:[{sha:'c',subject:'feat: x'}], changedFiles:[{path:'a.js',status:'M'}], provenance:{complete:true,totalCommits:1,reviewReceipts:1,commitReceipts:1}, preflight:{state:'READY',blockers:[],warnings:[]} }; }
test('Change Receipt keeps a stable published snapshot fingerprint and adds a remote-bound delivery fingerprint', async () => {
  const a = buildChangeReceipt(input()); await new Promise(r => setTimeout(r, 2)); const b = buildChangeReceipt(input());
  assert.equal(a.fingerprint, b.fingerprint); assert.equal(a.snapshotFingerprint, a.fingerprint);
  const final = finalizeChangeReceipt(a, {provider:'github',number:7,id:9,url:'https://github.com/o/r/pull/7',headSha:'h',sourceBranch:'feat',targetBranch:'main'}, 'created');
  assert.equal(final.fingerprint, a.fingerprint); assert.equal(final.snapshotFingerprint, a.snapshotFingerprint);
  assert.notEqual(final.deliveryFingerprint, a.fingerprint); assert.equal(final.changeRequest.number, 7);
});
test('delivery fingerprint binds the remote change-request identity', () => {
  const a = buildChangeReceipt(input());
  const x = finalizeChangeReceipt(a, {provider:'github',number:7,id:9,url:'https://github.com/o/r/pull/7',headSha:'h',sourceBranch:'feat',targetBranch:'main'}, 'created');
  const y = finalizeChangeReceipt(a, {provider:'github',number:8,id:10,url:'https://github.com/o/r/pull/8',headSha:'h',sourceBranch:'feat',targetBranch:'main'}, 'created');
  assert.notEqual(x.deliveryFingerprint, y.deliveryFingerprint);
});
