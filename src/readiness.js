'use strict';
function checkKey(item){return item.integrationId ? `${item.name}#${item.integrationId}` : item.name;}
function evaluateChecks(checks, required) {
  const exact=new Map(checks.map(c=>[checkKey(c),c])), byName=new Map(); for(const c of checks)if(!byName.has(c.name))byName.set(c.name,c);
  return (required||[]).map(req=>{const r=typeof req==='string'?{name:req}:req; return (r.integrationId?exact.get(`${r.name}#${r.integrationId}`):byName.get(r.name))||{name:r.name,integrationId:r.integrationId||null,state:'missing'};});
}
function evaluateApprovalRules(approvalState){if(!approvalState||!Array.isArray(approvalState.rules))return[];return approvalState.rules.filter(r=>Number(r.approvals_required||0)>0&&r.approved!==true).map(r=>({code:'approval_rule_pending',message:`GitLab approval rule pending: ${r.name||r.id||'unnamed'} (${Number(r.approved_by?.length||0)}/${Number(r.approvals_required||0)}).`}));}
function fallbackMergeClassification(){return{status:'waiting',code:'merge_state_unknown',message:'Provider merge state could not be classified safely.'};}
async function evaluateReadiness({provider,change,requiredChecks=[],requiredApprovals=0}){
  const blockers=[],pending=[],passed=[]; const freshRaw=await provider.getChangeRequest(change.number); const fresh=provider.normalize(freshRaw);
  if(change.headSha&&fresh.headSha&&change.headSha!==fresh.headSha)blockers.push({code:'change_head_moved',message:`PR/MR head moved from ${change.headSha} to ${fresh.headSha}; rerun Delivery Preflight.`});
  let nativePolicy={status:'none',requiredChecks:[],requiredApprovals:0,requireCodeOwners:false,requireThreadResolution:false,mergeQueue:false,allowedMergeMethods:[]};
  if(typeof provider.getMergePolicySnapshot==='function')nativePolicy=await provider.getMergePolicySnapshot(fresh.targetBranch).catch(()=>({status:'unknown',requiredChecks:[]}));
  const configured=(requiredChecks||[]).map(x=>typeof x==='string'?{name:x}:x); const native=(nativePolicy.requiredChecks||[]).map(x=>typeof x==='string'?{name:x}:x);
  const keyed=new Map([...native,...configured].map(x=>[`${x.name}#${x.integrationId||''}`,x])); const effectiveRequired=[...keyed.values()];
  const requiredCheckSource=nativePolicy.status==='unknown'?'unknown':native.length&&configured.length?'provider+configuration':native.length?'provider':configured.length?'configuration':'none';
  if(nativePolicy.status==='unknown')pending.push({code:'required_check_policy_unknown',message:'Could not verify provider merge policy; readiness remains non-authoritative.'});
  const effectiveApprovals=Math.max(Number(requiredApprovals||0),Number(nativePolicy.requiredApprovals||0));
  const [checks,approvals,approvalState,externalChecks]=await Promise.all([
    provider.listChecks(fresh.provider==='gitlab'?fresh.number:(fresh.headSha||'')), provider.listApprovals(fresh.number),
    typeof provider.getApprovalState==='function'?provider.getApprovalState(fresh.number).catch(()=>null):null,
    typeof provider.listExternalStatusChecks==='function'?provider.listExternalStatusChecks(fresh.number).catch(()=>[]):[]
  ]);
  const selected=evaluateChecks(checks,effectiveRequired); for(const c of selected){if(c.state==='success')passed.push({type:'check',name:c.name});else if(c.state==='pending')pending.push({code:'check_pending',message:`Check pending: ${c.name}`});else blockers.push({code:c.state==='missing'?'required_check_missing':'check_failed',message:`${c.state==='missing'?'Required check missing':'Check failed'}: ${c.name}`});}
  for(const c of externalChecks){if(c.state==='success')passed.push({type:'external-check',name:c.name});else if(c.state==='pending')pending.push({code:'external_check_pending',message:`External status check pending: ${c.name}`});else blockers.push({code:'external_check_failed',message:`External status check failed: ${c.name}`});}
  pending.push(...evaluateApprovalRules(approvalState)); if(approvals.length<effectiveApprovals)pending.push({code:'approvals_missing',message:`Approvals ${approvals.length}/${effectiveApprovals}.`});else passed.push({type:'approval',name:`${approvals.length}/${effectiveApprovals}`});
  if(fresh.draft)blockers.push({code:'draft',message:'Change request is still draft.'}); if(fresh.conflicts)blockers.push({code:'conflicts',message:'SCM reports merge conflicts.'}); if(fresh.blockingDiscussionsResolved===false)blockers.push({code:'unresolved_discussions',message:'Blocking discussions are unresolved.'});
  const classified=typeof provider.classifyMergeState==='function'?provider.classifyMergeState(fresh):fallbackMergeClassification();
  if(classified.status==='blocked')blockers.push({code:classified.code||'merge_state_blocked',message:classified.message}); else if(classified.status!=='ready')pending.push({code:classified.code||'merge_state_pending',message:classified.message});
  const state=blockers.length?'BLOCKED':pending.length?'WAITING':'READY_TO_MERGE';
  return{state,blockers,pending,passed,checks:selected,observedChecks:checks,externalChecks,requiredChecks:effectiveRequired,requiredCheckSource,requiredApprovals:effectiveApprovals,approvals,approvalState,nativePolicy,change:fresh};
}
module.exports={evaluateReadiness,evaluateChecks,evaluateApprovalRules,checkKey};
