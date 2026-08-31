'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { evaluateReadiness, evaluateApprovalRules, evaluateMergeState } = require('../src/readiness');
function change(overrides={}) { return {provider:'github',number:1,headSha:'h',targetBranch:'main',raw:{},...overrides}; }
test('GitHub readiness uses discovered required checks and approvals', async()=>{
  let checkSha='';
  const p={ getRequiredCheckNames:async()=>({status:'available',names:['build']}), getChangeRequest:async()=>({number:1,head:{sha:'h',ref:'feat'},base:{ref:'main'},draft:false,mergeable:true,mergeable_state:'clean',html_url:'u'}), normalize:r=>({provider:'github',number:1,headSha:r.head.sha,targetBranch:'main',draft:false,conflicts:false,mergeState:'clean',url:'u',raw:r}), listChecks:async sha=>(checkSha=sha,[{name:'build',state:'success'}]), listApprovals:async()=>['alice'] };
  const r=await evaluateReadiness({provider:p,change:change(),requiredChecks:[],requiredApprovals:1}); assert.equal(r.state,'READY_TO_MERGE'); assert.equal(r.requiredCheckSource,'provider'); assert.equal(checkSha,'h');
});
test('missing required check is a blocker', async()=>{
  const p={ getChangeRequest:async()=>({}), normalize:r=>({provider:'github',number:1,headSha:'h',targetBranch:'main',draft:false,conflicts:false,mergeState:'clean',raw:r}), listChecks:async()=>[], listApprovals:async()=>[] };
  const r=await evaluateReadiness({provider:p,change:change(),requiredChecks:['build'],requiredApprovals:0}); assert.equal(r.state,'BLOCKED'); assert.equal(r.blockers[0].code,'required_check_missing');
});
test('readiness blocks when the remote head moved after local change resolution', async()=>{
  const p={ getChangeRequest:async()=>({}), normalize:r=>({provider:'github',number:1,headSha:'new',targetBranch:'main',draft:false,conflicts:false,mergeState:'clean',raw:r}), listChecks:async sha=>{ assert.equal(sha,'new'); return []; }, listApprovals:async()=>[] };
  const r=await evaluateReadiness({provider:p,change:change({headSha:'old'}),requiredChecks:[],requiredApprovals:0}); assert.equal(r.state,'BLOCKED'); assert.ok(r.blockers.some(x=>x.code==='change_head_moved'));
});
test('GitLab approval rules and merge states are classified deterministically',()=>{ assert.equal(evaluateApprovalRules({rules:[{name:'Security',approved:false,approvals_required:2,approved_by:[{}]}]}).length,1); assert.equal(evaluateMergeState({mergeState:'ci_must_pass'}).blockers.length,1); assert.equal(evaluateMergeState({mergeState:'ci_still_running'}).pending.length,1); });
