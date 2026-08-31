'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { checkState, jobCheckState, versionAtLeast } = require('../src/providers/gitlab');
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
test('GitLab cross-project MR is created from source project with target_project_id',async()=>{const{GitLabProvider}=require('../src/providers/gitlab');const source={host:'gitlab.local',projectPath:'me/fork'},target={host:'gitlab.local',projectPath:'org/repo'};const p=new GitLabProvider({remote:target,sourceRemote:source,apiBaseUrl:'https://gitlab.local/api/v4',token:'x',timeoutMs:1000});p.projectInfo=async r=>r.projectPath===source.projectPath?{id:2}:{id:3};let seen;p.client.request=async(method,path,opts)=>(seen={method,path,body:opts.body},{data:{iid:1}});await p.createChangeRequest({sourceBranch:'feat',targetBranch:'main',title:'t',body:'b',draft:false});assert.match(seen.path,/projects\/me%2Ffork\/merge_requests$/);assert.equal(seen.body.target_project_id,3);});
test('GitLab merge train binds current head SHA and version-aware auto merge',async()=>{const{GitLabProvider}=require('../src/providers/gitlab');const remote={host:'gitlab.local',projectPath:'org/repo'};const p=new GitLabProvider({remote,apiBaseUrl:'https://gitlab.local/api/v4',token:'x',timeoutMs:1000});p.validateCompatibility=async()=>({version:'17.11.7',autoMergeParameter:'auto_merge'});let body;p.client.request=async(_m,_p,o)=>(body=o.body,{data:{id:1}});await p.enqueueMergeTrain({iid:4,sha:'abc'});assert.equal(body.sha,'abc');assert.equal(body.auto_merge,true);});
