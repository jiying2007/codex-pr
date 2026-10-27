'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const{GitHubProvider,requiredChecksFromRules}=require('../src/providers/github');
function provider(){return new GitHubProvider({remote:{owner:'o',projectPath:'o/r',host:'github.com'},sourceRemote:{owner:'o',projectPath:'o/r',host:'github.com'},apiBaseUrl:'https://api.github.com',token:'x',timeoutMs:1000,allowInsecureHttp:false});}
test('GitHub active rulesets produce check identities and merge policy',async()=>{assert.deepEqual(requiredChecksFromRules([{type:'required_status_checks',parameters:{required_status_checks:[{context:'build',integration_id:7},{context:'lint'}]}}]),[{name:'build',integrationId:7},{name:'lint',integrationId:null}]);const p=provider();p.client.request=async(_m,path)=>path.endsWith('/protection')?{status:404,data:null}:{status:200,data:[{type:'required_status_checks',parameters:{required_status_checks:[{context:'build'}]}},{type:'pull_request',parameters:{required_approving_review_count:2,require_code_owner_review:true}}]};p.client.paginate=async()=>({complete:true,items:[{type:'required_status_checks',parameters:{required_status_checks:[{context:'build'}]}},{type:'pull_request',parameters:{required_approving_review_count:2,require_code_owner_review:true}}]});const policy=await p.getMergePolicySnapshot('main');assert.equal(policy.status,'available');assert.deepEqual(policy.requiredChecks,[{name:'build',integrationId:null}]);assert.equal(policy.requiredApprovals,2);assert.equal(policy.requireCodeOwners,true);});
test('GitHub merge policy fails closed when rules are unreadable',async()=>{const p=provider();p.client.request=async(_m,path)=>path.endsWith('/protection')?{status:200,data:{required_status_checks:{contexts:['classic']}}}:{status:403,data:null};const policy=await p.getMergePolicySnapshot('main');assert.equal(policy.status,'unknown');assert.equal(policy.requiredChecks[0].name,'classic');});
test('GitHub fork create namespaces head and binds head_repo',async()=>{const p=new GitHubProvider({remote:{owner:'org',projectPath:'org/r',host:'github.com'},sourceRemote:{owner:'me',projectPath:'me/r',host:'github.com'},apiBaseUrl:'https://api.github.com',token:'x',timeoutMs:1000});let body;p.client.request=async(_m,_path,o)=>(body=o.body,{data:{}});await p.createChangeRequest({sourceBranch:'feat',targetBranch:'main',title:'t',body:'b',draft:true});assert.equal(body.head,'me:feat');assert.equal(body.head_repo,'me/r');});

test('GitHub auto-merge and merge-queue mutations are exact-head conditional writes',async()=>{
 const p=provider(),head='a'.repeat(40),calls=[],change={node_id:'PR_node',head:{sha:head}};
 p.graphql=async(query,variables)=>{calls.push({query,variables});return{enablePullRequestAutoMerge:{pullRequest:{id:change.node_id}},enqueuePullRequest:{mergeQueueEntry:{id:'queue'}}};};
 await p.enableAutoMerge(change);
 await p.enqueueMergeQueue(change);
 assert.equal(calls.length,2);
 for(const {query,variables} of calls){
  assert.match(query,/\$head:GitObjectID!/);
  assert.match(query,/expectedHeadOid:\$head/);
  assert.equal(variables.head,head);
  assert.equal(variables.id,change.node_id);
 }
});
test('missing or malformed PR head prevents remote GitHub merge mutation',async()=>{
 const p=provider(),calls=[];
 p.graphql=async()=>{calls.push(true);return{};};
 for(const missing of [null,undefined,{}, {node_id:'PR_node',head:{sha:''}}, {node_id:'PR_node',head:{sha:'bad'}}]){
  await assert.rejects(()=>p.enableAutoMerge(missing),error=>error?.code==='EHEADBOUND');
  await assert.rejects(()=>p.enqueueMergeQueue(missing),error=>error?.code==='EHEADBOUND');
 }
 assert.deepEqual(calls,[]);
});
