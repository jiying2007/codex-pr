'use strict';
function evaluateChecks(checks, requiredNames) {
  const byName = new Map(checks.map(c => [c.name, c]));
  if (requiredNames.length) return requiredNames.map(name => byName.get(name) || { name, state: 'missing' });
  return [];
}
function evaluateApprovalRules(approvalState) {
  if (!approvalState || !Array.isArray(approvalState.rules)) return [];
  return approvalState.rules
    .filter(rule => Number(rule.approvals_required || 0) > 0 && rule.approved !== true)
    .map(rule => ({ code: 'approval_rule_pending', message: `GitLab approval rule pending: ${rule.name || rule.id || 'unnamed'} (${Number(rule.approved_by?.length || 0)}/${Number(rule.approvals_required || 0)}).` }));
}
function evaluateMergeState(fresh) {
  const blockers = [], pending = []; const state = String(fresh.mergeState || 'unknown');
  const blockerStates = new Set(['dirty', 'conflicts', 'ci_must_pass', 'discussions_not_resolved', 'requested_changes', 'need_rebase', 'not_open', 'locked_paths']);
  const pendingStates = new Set(['unknown', 'checking', 'unchecked', 'cannot_be_merged_recheck', 'preparing', 'checking_pipeline_status', 'ci_still_running', 'not_approved', 'behind', 'blocked']);
  if (blockerStates.has(state)) blockers.push({ code: 'merge_state_blocked', message: `SCM merge state blocks merge: ${state}.` });
  else if (pendingStates.has(state)) pending.push({ code: 'merge_state_pending', message: `Mergeability is not ready: ${state}.` });
  return { blockers, pending };
}
async function evaluateReadiness({ provider, change, requiredChecks = [], requiredApprovals = 0 }) {
  const blockers = [], pending = [], passed = [];

  const freshRaw = await provider.getChangeRequest(change.number);
  const fresh = provider.normalize(freshRaw);
  if (change.headSha && fresh.headSha && change.headSha !== fresh.headSha) {
    blockers.push({ code: 'change_head_moved', message: `PR/MR head moved from ${change.headSha} to ${fresh.headSha}; rerun Delivery Preflight before trusting readiness.` });
  }

  let effectiveRequired = [...requiredChecks]; let requiredCheckSource = requiredChecks.length ? 'configuration' : 'none';
  if (!effectiveRequired.length && typeof provider.getRequiredCheckNames === 'function') {
    const discovered = await provider.getRequiredCheckNames(fresh.targetBranch).catch(() => ({ status: 'unknown', names: [] }));
    if (discovered.status === 'available' || discovered.status === 'none') {
      effectiveRequired = discovered.names || [];
      requiredCheckSource = 'provider';
    } else if (discovered.status === 'unknown') {
      requiredCheckSource = 'unknown';
      pending.push({ code: 'required_check_policy_unknown', message: 'Could not verify provider required-check policy; configure safeCodexChange.requiredChecks to make the gate deterministic.' });
    }
  }

  const [checks, approvals, approvalState] = await Promise.all([
    provider.listChecks(fresh.provider === 'gitlab' ? fresh.number : (fresh.headSha || '')),
    provider.listApprovals(fresh.number),
    typeof provider.getApprovalState === 'function' ? provider.getApprovalState(fresh.number).catch(() => null) : null
  ]);

  const selected = evaluateChecks(checks, effectiveRequired);
  for (const check of selected) {
    if (check.state === 'success') passed.push({ type: 'check', name: check.name });
    else if (check.state === 'pending') pending.push({ code: 'check_pending', message: `Check pending: ${check.name}` });
    else blockers.push({ code: check.state === 'missing' ? 'required_check_missing' : 'check_failed', message: `${check.state === 'missing' ? 'Required check missing' : 'Check failed'}: ${check.name}` });
  }

  const rulePending = evaluateApprovalRules(approvalState); if (rulePending.length) pending.push(...rulePending);
  if (approvals.length < requiredApprovals) pending.push({ code: 'approvals_missing', message: `Approvals ${approvals.length}/${requiredApprovals}.` });
  else passed.push({ type: 'approval', name: `${approvals.length}/${requiredApprovals}` });
  if (fresh.draft) blockers.push({ code: 'draft', message: 'Change request is still draft.' });
  if (fresh.conflicts) blockers.push({ code: 'conflicts', message: 'SCM reports merge conflicts.' });
  if (fresh.blockingDiscussionsResolved === false) blockers.push({ code: 'unresolved_discussions', message: 'Blocking GitLab discussions are unresolved.' });
  const merge = evaluateMergeState(fresh); blockers.push(...merge.blockers); pending.push(...merge.pending);
  const state = blockers.length ? 'BLOCKED' : pending.length ? 'WAITING' : 'READY_TO_MERGE';
  return { state, blockers, pending, passed, checks: selected, observedChecks: checks, requiredChecks: effectiveRequired, requiredCheckSource, approvals, approvalState, change: fresh };
}
module.exports = { evaluateReadiness, evaluateChecks, evaluateApprovalRules, evaluateMergeState };
