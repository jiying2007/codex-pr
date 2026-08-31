'use strict';
const { finalizeChangeReceipt } = require('./receipt');
const STORAGE_KEY = 'safeCodexChange.changeReceipts.v1';
const MAX_PER_REPO = 50;
function keyFor(provider, repository) { return `${String(provider).toLowerCase()}:${String(repository).toLowerCase()}`; }
function createChangeReceiptStore(globalState) {
  async function persist(receipt, change, action) {
    const finalReceipt = finalizeChangeReceipt(receipt, change, action);
    if (!globalState) return finalReceipt;
    const all = globalState.get(STORAGE_KEY, {}) || {};
    const key = keyFor(receipt.provider, receipt.repository);
    const current = Array.isArray(all[key]) ? all[key] : [];
    const next = [finalReceipt, ...current]
      .filter((item, index, list) => list.findIndex(other => (other.deliveryFingerprint || other.fingerprint) === (item.deliveryFingerprint || item.fingerprint)) === index)
      .slice(0, MAX_PER_REPO);
    await globalState.update(STORAGE_KEY, { ...all, [key]: next });
    return finalReceipt;
  }
  function list(provider, repository) {
    const all = globalState?.get(STORAGE_KEY, {}) || {};
    return (all[keyFor(provider, repository)] || []).map(item => ({ ...item }));
  }
  return Object.freeze({ persist, list });
}
module.exports = { STORAGE_KEY, MAX_PER_REPO, keyFor, createChangeReceiptStore };
