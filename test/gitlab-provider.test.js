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
