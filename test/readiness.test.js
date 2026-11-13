'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const{evaluateReadiness,evaluateApprovalRules}=require('../src/readiness');const{GitLabProvider}=require('../src/providers/gitlab');
function change(overrides={}){return{provider:'github',number:1,headSha:'h',targetBranch:'main',raw:{},...overrides};}
test('readiness unions provider and configured checks and approvals',async()=>{let checkSha='';const p={getMergePolicySnapshot:async()=>({status:'available',requiredChecks:[{name:'build',integrationId:7}],requiredApprovals:2}),getChangeRequest:async()=>({}),normalize:r=>({provider:'github',number:1,headSha:'h',targetBranch:'main',draft:false,conflicts:false,mergeState:'clean',raw:r}),classifyMergeState:()=>({status:'ready',message:'clean'}),listChecks:async sha=>(checkSha=sha,[{name:'build',integrationId:7,state:'success'},{name:'lint',state:'success'}]),listApprovals:async()=>['a','b']};const r=await evaluateReadiness({provider:p,change:change(),requiredChecks:['lint'],requiredApprovals:1});assert.equal(r.state,'READY_TO_MERGE');assert.equal(r.requiredCheckSource,'provider+configuration');assert.equal(r.requiredApprovals,2);assert.equal(checkSha,'h');});
test('unknown provider merge state fails closed to WAITING',async()=>{const p={getMergePolicySnapshot:async()=>({status:'none',requiredChecks:[],requiredApprovals:0}),getChangeRequest:async()=>({}),normalize:r=>({provider:'github',number:1,headSha:'h',targetBranch:'main',draft:false,conflicts:false,mergeState:'future_state',raw:r}),classifyMergeState:()=>({status:'waiting',code:'merge_state_unknown',message:'unknown'}),listChecks:async()=>[],listApprovals:async()=>[]};const r=await evaluateReadiness({provider:p,change:change()});assert.equal(r.state,'WAITING');assert.ok(r.pending.some(x=>x.code==='merge_state_unknown'));});
test('GitLab conflict is blocked and unknown is waiting',()=>{const p=Object.create(GitLabProvider.prototype);assert.equal(p.classifyMergeState({mergeState:'conflict'}).status,'blocked');assert.equal(p.classifyMergeState({mergeState:'brand_new_state'}).status,'waiting');assert.equal(p.classifyMergeState({mergeState:'mergeable'}).status,'ready');});
test('GitLab external status checks participate in readiness',async()=>{const p={getMergePolicySnapshot:async()=>({status:'available',requiredChecks:[],requiredApprovals:0}),getChangeRequest:async()=>({}),normalize:r=>({provider:'gitlab',number:1,headSha:'h',targetBranch:'main',draft:false,conflicts:false,mergeState:'mergeable',raw:r}),classifyMergeState:()=>({status:'ready',message:'ok'}),listChecks:async()=>[],listApprovals:async()=>[],listExternalStatusChecks:async()=>[{name:'Compliance',state:'pending'}]};const r=await evaluateReadiness({provider:p,change:{provider:'gitlab',number:1,headSha:'h'}});assert.equal(r.state,'WAITING');assert.ok(r.pending.some(x=>x.code==='external_check_pending'));});
test('approval rules stay deterministic',()=>{assert.equal(evaluateApprovalRules({rules:[{name:'Security',approved:false,approvals_required:2,approved_by:[{}]}]}).length,1);});

test('SCM verification transport failures never become zero approvals or absent external checks',async()=>{
 const base=()=>({
   getChangeRequest:async()=>({}),normalize:()=>({provider:'gitlab',number:1,headSha:'h',targetBranch:'main',mergeState:'mergeable',draft:false,conflicts:false}),
   getMergePolicySnapshot:async()=>({status:'available',requiredChecks:[],requiredApprovals:0}),
   listChecks:async()=>[],listApprovals:async()=>[],
   getApprovalState:async()=>({rules:[]}),listExternalStatusChecks:async()=>[],
   classifyMergeState:()=>({status:'ready',code:'ready',message:'ready'})
 });
 const p=base();p.getApprovalState=async()=>{throw new Error('approval API timed out');};
 await assert.rejects(()=>evaluateReadiness({provider:p,change:{provider:'gitlab',number:1}}),/approval API timed out/);
 const q=base();q.listExternalStatusChecks=async()=>{throw new Error('external checks API timed out');};
 await assert.rejects(()=>evaluateReadiness({provider:q,change:{provider:'gitlab',number:1}}),/external checks API timed out/);
 assert.equal((await evaluateReadiness({provider:base(),change:{provider:'gitlab',number:1}})).state,'READY_TO_MERGE');
});

test('same-name GitHub status and check-run must both be green before readiness can pass',()=>{
 const {evaluateChecks}=require('../src/readiness');
 const status={name:'CI Gate',integrationId:null,state:'success'};
 const failedRun={name:'CI Gate',integrationId:15368,state:'failure'};
 for(const values of [[status,failedRun],[failedRun,status]]){
   const selected=evaluateChecks(values,['CI Gate']);
   assert.equal(selected[0].state,'failure','a green commit status cannot conceal a failed check run');
 }
 const pending={name:'CI Gate',integrationId:15368,state:'pending'};
 assert.equal(evaluateChecks([status,pending],['CI Gate'])[0].state,'pending');
 assert.equal(evaluateChecks([status,{...pending,state:'success'}],['CI Gate'])[0].state,'success');
 assert.equal(evaluateChecks([status],[{name:'CI Gate',integrationId:15368}])[0].state,'missing');
 assert.equal(evaluateChecks([status,{...pending,state:'unknown'}],['CI Gate'])[0].state,'failure');
 assert.equal(evaluateChecks([],['CI Gate'])[0].state,'missing');
});
