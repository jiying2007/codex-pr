'use strict';

// An approval is granted for one immutable SCM operation target, not whatever
// branch happens to be active after the confirmation dialog is dismissed.
function drift(message) {
  return Object.assign(new Error(message), { code:'ECHANGEIDENTITY' });
}
function assertConfirmedChange(before, after) {
  if (!before && !after) return;
  if (!before || !after) throw drift('PR/MR changed while awaiting confirmation; preview and confirm again.');
  for (const key of ['number','url','headSha','sourceBranch','targetBranch']) {
    if (before[key] == null || after[key] == null || String(before[key]) !== String(after[key])) {
      throw drift(`Confirmed PR/MR ${key} changed; preview and confirm again.`);
    }
  }
}
function assertConfirmedPreflight(before, after) {
  if (!before || !after) throw drift('Delivery preflight disappeared during confirmation.');
  for (const key of ['sourceBranch','targetBranch','headSha','targetSha','mergeBase']) {
    if (before[key] !== after[key]) throw drift(`Confirmed preflight ${key} changed; preview and confirm again.`);
  }
  for (const remote of ['sourceRemote','targetRemote']) {
    for (const key of ['host','projectPath']) {
      if (before[remote]?.[key] !== after[remote]?.[key]) throw drift(`Confirmed ${remote} ${key} changed; preview and confirm again.`);
    }
  }
}
module.exports = { assertConfirmedChange, assertConfirmedPreflight };
