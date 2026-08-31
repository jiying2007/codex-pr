'use strict';
const DEFER_SAFE = new Set(['check_pending','approvals_missing','approval_rule_pending','merge_state_pending','external_check_pending','merge_train_waiting']);
function authorize(operation, prepared, readiness = null) {
  const blockers = [...(prepared?.preflight?.blockers || [])];
  if (prepared?.preflight?.state === 'BLOCKED' || blockers.length) return { decision:'DENY', reason:'preflight', blockers, pending:[] };
  if (!readiness) return { decision:'ALLOW', reason:'preflight', blockers:[], pending:[] };
  if (readiness.blockers?.length) return { decision:'DENY', reason:'readiness', blockers:readiness.blockers, pending:readiness.pending || [] };
  if (readiness.requiredCheckSource === 'unknown') return { decision:'DENY', reason:'policy-unknown', blockers:[{code:'required_check_policy_unknown',message:'Provider required-check policy is unknown.'}], pending:readiness.pending || [] };
  if (operation === 'enqueueMergeQueue' || operation === 'mergeTrain') return readiness.state === 'READY_TO_MERGE'
    ? {decision:'ALLOW',reason:'ready',blockers:[],pending:[]}
    : {decision:'DENY',reason:'not-ready',blockers:[],pending:readiness.pending||[]};
  if (operation === 'enableAutoMerge' && readiness.state === 'WAITING') {
    const unsafe=(readiness.pending||[]).filter(x=>!DEFER_SAFE.has(x.code));
    return unsafe.length ? {decision:'DENY',reason:'unsafe-wait',blockers:unsafe,pending:readiness.pending||[]} : {decision:'DEFER_SAFE',reason:'native-auto-merge',blockers:[],pending:readiness.pending||[]};
  }
  return readiness.state === 'READY_TO_MERGE' ? {decision:'ALLOW',reason:'ready',blockers:[],pending:[]} : {decision:'DENY',reason:'not-ready',blockers:[],pending:readiness.pending||[]};
}
module.exports={authorize,DEFER_SAFE};
