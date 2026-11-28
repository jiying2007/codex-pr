'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { GitLabProvider, checkState, jobCheckState, versionAtLeast } = require('../src/providers/gitlab');
test('GitLab job states preserve blocking versus optional manual/allow-failure semantics',()=>{
  assert.equal(checkState('success'),'success');
  assert.equal(checkState('running'),'pending');
  assert.equal(checkState('failed'),'failure');
  assert.equal(checkState('manual'),'pending');
  assert.equal(jobCheckState({status:'manual',allow_failure:true}),'success');
  assert.equal(jobCheckState({status:'manual',allow_failure:false}),'pending');
  assert.equal(jobCheckState({status:'failed',allow_failure:true}),'success');
});
test('GitLab capability version comparison supports classic self-managed baseline',()=>{ assert.equal(versionAtLeast('14.6.1-ee','14.6.1'),true); assert.equal(versionAtLeast('17.10.9','17.11.0'),false); assert.equal(versionAtLeast('17.11.0','17.11.0'),true); });
test('GitLab cross-project MR is created from source project with target_project_id',async()=>{const source={host:'gitlab.local',projectPath:'me/fork'},target={host:'gitlab.local',projectPath:'org/repo'};const p=new GitLabProvider({remote:target,sourceRemote:source,apiBaseUrl:'https://gitlab.local/api/v4',token:'x',timeoutMs:1000});p.projectInfo=async r=>r.projectPath===source.projectPath?{id:2}:{id:3};let seen;p.client.request=async(method,path,opts)=>(seen={method,path,body:opts.body},{data:{iid:1}});await p.createChangeRequest({sourceBranch:'feat',targetBranch:'main',title:'t',body:'b',draft:false});assert.match(seen.path,/projects\/me%2Ffork\/merge_requests$/);assert.equal(seen.body.target_project_id,3);});
test('GitLab merge train binds current head SHA and version-aware auto merge',async()=>{const remote={host:'gitlab.local',projectPath:'org/repo'};const p=new GitLabProvider({remote,apiBaseUrl:'https://gitlab.local/api/v4',token:'x',timeoutMs:1000});p.validateCompatibility=async()=>({version:'17.11.7',autoMergeParameter:'auto_merge'});let body;p.client.request=async(_m,_p,o)=>(body=o.body,{data:{id:1}});const head='a'.repeat(40);await p.enqueueMergeTrain({iid:4,sha:head});assert.equal(body.sha,head);assert.equal(body.auto_merge,true);});
test('legacy merge_status remains safely classified',()=>{const p=Object.create(GitLabProvider.prototype);assert.equal(p.classifyMergeState({mergeState:'can_be_merged'}).status,'ready');assert.equal(p.classifyMergeState({mergeState:'cannot_be_merged'}).status,'blocked');assert.equal(p.classifyMergeState({mergeState:'cannot_be_merged_recheck'}).status,'waiting');});

test('GitLab merge writes always carry a valid confirmed source head, including diff_refs-only responses',async()=>{
 const remote={host:'gitlab.local',projectPath:'org/repo'};
 const p=new GitLabProvider({remote,apiBaseUrl:'https://gitlab.local/api/v4',token:'fixture',timeoutMs:1000});
 const requests=[];p.validateCompatibility=async()=>({version:'17.11.7',autoMergeParameter:'auto_merge'});
 p.client.request=async(method,path,options)=>{requests.push({method,path,body:options.body});return{data:{id:1}};};
 const head='a'.repeat(40);
 for(const change of [{iid:4,sha:head},{iid:4,diff_refs:{head_sha:head}},{iid:4,sha:head,diff_refs:{head_sha:head}}]){
  await p.enableAutoMerge(change);await p.enqueueMergeTrain(change);
 }
 assert.equal(requests.length,6);
 assert.ok(requests.every(x=>x.body.sha===head&&x.body.auto_merge===true));
 requests.length=0;
 for(const invalid of [{iid:4},{iid:4,sha:'bad'},{iid:4,sha:head,diff_refs:{head_sha:'b'.repeat(40)}},{iid:4,sha:'bad',diff_refs:{head_sha:head}}]){
  await assert.rejects(()=>p.enableAutoMerge(invalid),{code:'EHEADBOUND'});
  await assert.rejects(()=>p.enqueueMergeTrain(invalid),{code:'EHEADBOUND'});
 }
 assert.equal(requests.length,0);
 p.validateCompatibility=async()=>({version:'14.6.1',autoMergeParameter:'merge_when_pipeline_succeeds'});
 await p.enableAutoMerge({iid:4,diff_refs:{head_sha:head}});
 await p.enqueueMergeTrain({iid:4,sha:head});
 assert.equal(requests[0].body.merge_when_pipeline_succeeds,true);
 assert.equal(requests[1].body.when_pipeline_succeeds,true);
 assert.ok(requests.every(x=>x.body.sha===head));
});
test('GitLab MR discovery requires both exact project identities and does not silently choose among matches',async()=>{
 const source={host:'gitlab.local',projectPath:'me/fork'},target={host:'gitlab.local',projectPath:'org/repo'};
 const p=new GitLabProvider({remote:target,sourceRemote:source,apiBaseUrl:'https://gitlab.local/api/v4',token:'fixture',timeoutMs:1000});
 p.projectInfo=async r=>({id:r.projectPath===source.projectPath?2:3});
 const exact={iid:5,source_project_id:2,target_project_id:3,source_branch:'feat',target_branch:'main'};
 let rows=[{...exact,iid:1,source_project_id:4},{...exact,iid:2,target_project_id:9},exact];
 p.client.paginate=async()=>({complete:true,items:rows});
 assert.equal((await p.findOpenChangeRequest('feat','main')).iid,5);
 rows=[{...exact,iid:1,source_project_id:4}];assert.equal(await p.findOpenChangeRequest('feat','main'),null);
 rows=[{...exact,source_project_id:null}];await assert.rejects(()=>p.findOpenChangeRequest('feat','main'),{code:'ECHANGEIDENTITY'});
 rows=[exact,{...exact,iid:6}];await assert.rejects(()=>p.findOpenChangeRequest('feat','main'),{code:'ECHANGEIDENTITY'});
 rows=[{...exact,source_branch:'other'}];await assert.rejects(()=>p.findOpenChangeRequest('feat','main'),{code:'ECHANGEIDENTITY'});
 p.projectInfo=async()=>({});let writes=0;p.client.request=async()=>{writes++;return{data:{}};};
 await assert.rejects(()=>p.findOpenChangeRequest('feat','main'),{code:'ECHANGEIDENTITY'});
 await assert.rejects(()=>p.createChangeRequest({sourceBranch:'feat',targetBranch:'main',title:'t',body:'b'}),{code:'ECHANGEIDENTITY'});
 assert.equal(writes,0);
});

function pipelineFixture(overrides={}){
 const head='a'.repeat(40),target='b'.repeat(40),merge='c'.repeat(40),old='d'.repeat(40);
 const remote={host:'gitlab.local',projectPath:'org/r'},sourceRemote={host:'gitlab.local',projectPath:'fork/r'};
 const p=new GitLabProvider({remote,sourceRemote,apiBaseUrl:'https://gitlab.local/api/v4',token:'fixture',timeoutMs:1000});
 const mr={iid:5,sha:head,source_project_id:2,target_project_id:3,source_branch:'feat',target_branch:'main',head_pipeline:{id:10,project_id:2,sha:head,ref:'feat',status:'success'},...overrides};
 const calls=[];
 p.projectInfo=async r=>({id:r.projectPath==='fork/r'?2:3});
 p.getChangeRequest=async()=>structuredClone(mr);
 p.getTargetBranchSha=async()=>target;
 p.listPipelines=async()=>[{id:9,sha:old,status:'success'}];
 p.client.request=async(method,path)=>{calls.push(path);return path.includes('/repository/commits/')?{data:{id:merge,parent_ids:[target,head]}}:{status:200};};
 p.client.paginate=async path=>{calls.push(path);return{complete:true,items:[{id:7,name:'build',status:'success'}]};};
 return {p,mr,head,target,merge,old,calls};
}
test('GitLab pipeline checks use the bound current pipeline project rather than the MR target project',async()=>{
 const {p,head,calls}=pipelineFixture();
 const checks=await p.listChecks(5,head);
 assert.equal(checks[0].state,'success');
 assert.deepEqual(calls,['/projects/2/pipelines/10/jobs','/projects/2/pipelines/10/jobs']);
});
test('stale, missing, unbound or foreign head pipelines cannot contribute green jobs',async()=>{
 for(const kind of ['old','missing','foreign','ref','no-sha','wrong-head']){
  const f=pipelineFixture();
  if(kind==='old')f.mr.head_pipeline.sha=f.old;
  if(kind==='missing')f.mr.head_pipeline=null;
  if(kind==='foreign')f.mr.head_pipeline.project_id=8;
  if(kind==='ref')f.mr.head_pipeline.ref='other';
  if(kind==='no-sha')f.mr.head_pipeline.sha='';
  await assert.rejects(()=>f.p.listChecks(5,kind==='wrong-head'?f.old:f.head),{code:'EPIPELINEBOUND'});
  assert.equal(f.calls.length,0);
 }
 const f=pipelineFixture({head_pipeline:null});f.p.listPipelines=async()=>[];
 assert.deepEqual(await f.p.listChecks(5,f.head),[]);
});
test('merged-results checks require both current target and source parents; merge trains are not guessed',async()=>{
 const f=pipelineFixture();
 f.mr.head_pipeline={id:10,project_id:3,sha:f.merge,ref:'refs/merge-requests/5/merge',source:'merge_request_event',status:'success'};
 assert.equal((await f.p.listChecks(5,f.head))[0].state,'success');
 const bad=pipelineFixture({head_pipeline:f.mr.head_pipeline});
 bad.p.client.request=async()=>({data:{id:bad.merge,parent_ids:[bad.old,bad.head]}});
 await assert.rejects(()=>bad.p.listChecks(5,bad.head),{code:'EPIPELINEBOUND'});
 const train=pipelineFixture({head_pipeline:{...f.mr.head_pipeline,ref:'refs/merge-requests/5/train'}});
 await assert.rejects(()=>train.p.listChecks(5,train.head),{code:'EPIPELINEBOUND'});
 assert.equal(train.calls.length,0);
});
test('a pipeline replacement during job enumeration invalidates observed checks',async()=>{
 const f=pipelineFixture();
 let reads=0;
 f.p.getChangeRequest=async()=>{const raw=structuredClone(f.mr);if(++reads>1)raw.head_pipeline.id=11;return raw;};
 await assert.rejects(()=>f.p.listChecks(5,f.head),{code:'EPIPELINEBOUND'});
});

test('absence of an authoritative GitLab pipeline is rechecked after empty history',async()=>{
 const stable=pipelineFixture({head_pipeline:null});let reads=0;
 stable.p.getChangeRequest=async()=>{reads++;return structuredClone(stable.mr);};
 stable.p.listPipelines=async()=>[];
 assert.deepEqual(await stable.p.listChecks(5,stable.head),[]);
 assert.equal(reads,2);
 for(const kind of ['pipeline-attached','head-moved','source-branch','target-branch','source-project','target-project','iid']){
  const f=pipelineFixture({head_pipeline:null});let calls=0,history=0;
  f.p.listPipelines=async()=>{history++;return [];};
  f.p.getChangeRequest=async()=>{
   const raw=structuredClone(f.mr);
   if(++calls===2){
    if(kind==='pipeline-attached')raw.head_pipeline={id:11,project_id:2,sha:f.head,ref:'feat',status:'running'};
    if(kind==='head-moved')raw.sha=f.old;
    if(kind==='source-branch')raw.source_branch='other';
    if(kind==='target-branch')raw.target_branch='other';
    if(kind==='source-project')raw.source_project_id=8;
    if(kind==='target-project')raw.target_project_id=8;
    if(kind==='iid')raw.iid=6;
   }
   return raw;
  };
  await assert.rejects(f.p.listChecks(5,f.head),{code:'EPIPELINEBOUND'},kind);
  assert.equal(history,1);assert.equal(calls,2);assert.equal(f.calls.length,0);
 }
});
test('empty history cannot qualify an MR with a foreign project or missing branch identity',async()=>{
 for(const overrides of [{source_project_id:99},{target_project_id:99},{source_branch:''},{target_branch:''}]){
  const f=pipelineFixture({head_pipeline:null,...overrides});let history=0;
  f.p.listPipelines=async()=>{history++;return [];};
  await assert.rejects(f.p.listChecks(5,f.head),{code:'EPIPELINEBOUND'});
  assert.equal(history,0);
 }
});
test('GitLab merged-results pipeline source is bound across the final readback',async()=>{
 const f=pipelineFixture();
 f.mr.head_pipeline={id:10,project_id:3,sha:f.merge,ref:'refs/merge-requests/5/merge',source:'merge_request_event',status:'success'};
 let reads=0;
 f.p.getChangeRequest=async()=>{
  const raw=structuredClone(f.mr);
  if(++reads===2)raw.head_pipeline.source='push';
  return raw;
 };
 await assert.rejects(f.p.listChecks(5,f.head),{code:'EPIPELINEBOUND'});
});
