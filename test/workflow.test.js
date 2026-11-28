'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { applyProvenancePolicy } = require('../src/workflow');
const base={state:'READY',blockers:[],warnings:[],commits:[{sha:'a'},{sha:'b'}]};
test('blocking review evidence blocks delivery by default',()=>{ const p=applyProvenancePolicy(base,{reviewStatus:'available',reviewReceipts:2,commitStatus:'available',commitReceipts:2,blockedReviewCommits:1,incompleteReviewCommits:0,needsEvidenceReviewCommits:0},{provenancePolicy:'advisory',blockOnReviewFindings:true}); assert.equal(p.state,'BLOCKED'); assert.equal(p.blockers[0].code,'review_provenance_blocked'); });
test('require-all fails closed on incomplete provenance',()=>{ const p=applyProvenancePolicy(base,{reviewStatus:'available',reviewReceipts:1,commitStatus:'available',commitReceipts:2,blockedReviewCommits:0,incompleteReviewCommits:0,needsEvidenceReviewCommits:0},{provenancePolicy:'require-all'}); assert.equal(p.state,'BLOCKED'); assert.ok(p.blockers.some(x=>x.code==='review_provenance_incomplete')); });
const{assertExpectedChangeHead}=require('../src/workflow');
test('remote mutation authorization is bound to the expected head',()=>{assert.doesNotThrow(()=>assertExpectedChangeHead('abc',{headSha:'abc'},'check'));assert.throws(()=>assertExpectedChangeHead('abc',{headSha:'def'},'check'),{code:'ESTALE'});assert.throws(()=>assertExpectedChangeHead('abc',{headSha:'def'},'check',{afterMutation:true,url:'https://example/mr'}),error=>error.code==='ESTALEAFTERMUTATION'&&error.remoteMutationPossible===true);});

test('missing remote HEAD fails closed before and after mutation',()=>{
 for(const value of [undefined,null,{}, {headSha:''}]){
  assert.throws(()=>assertExpectedChangeHead('abc',value,'check'),error=>error.code==='ESTALE'&&error.actualHeadSha===''&&!error.remoteMutationPossible);
  assert.throws(()=>assertExpectedChangeHead('abc',value,'check',{afterMutation:true,url:'https://example/mr'}),error=>error.code==='ESTALEAFTERMUTATION'&&error.remoteMutationPossible&&error.changeUrl==='https://example/mr');
 }
 assert.throws(()=>assertExpectedChangeHead('',{headSha:''},'check'),{code:'ESTALE'});
});
test('missing head on a summary is accepted only after a successful identity readback',async()=>{
 const {normalizedFreshChange}=require('../src/workflow');
 const provider={normalize:x=>x,getChangeRequest:async()=>({number:1,headSha:'abc'})};
 const read=await normalizedFreshChange(provider,{number:1,headSha:''});
 assert.doesNotThrow(()=>assertExpectedChangeHead('abc',read,'check'));
 provider.getChangeRequest=async()=>({number:1,headSha:''});
 const unknown=await normalizedFreshChange(provider,{number:1,headSha:''});
 assert.throws(()=>assertExpectedChangeHead('abc',unknown,'check'),{code:'ESTALE'});
});

function deliveryFixture({existing=null,writeResult,readResult,sourceSha='a'.repeat(40),targetSha='b'.repeat(40),targetShaAfterWrite,targetShaAfterLabels,targetReadError}={}){
 const head='a'.repeat(40),target='b'.repeat(40),url='https://github.com/o/r/pull/1',calls=[];
 let remoteTargetSha=targetSha,targetReadCount=0;
 const git={currentBranch:async()=> 'feat',revParse:async ref=>ref==='HEAD'?head:target,remoteUrl:async()=> 'https://github.com/o/r.git',trackingRef:(r,b)=>r+'/'+b,mergeBase:async()=> 'c'.repeat(40),commits:async()=>[{sha:head,subject:'fix: test'}],changedFiles:async()=>[{status:'M',path:'src/a.js'}],statusPorcelain:async()=>'',upstream:async()=> 'origin/feat',showFile:async()=>''};
 const normal={number:1,id:1,provider:'github',headSha:head,sourceBranch:'feat',targetBranch:'main',body:'',url};
 const afterWrite=()=>{if(targetShaAfterWrite!==undefined)remoteTargetSha=targetShaAfterWrite;};
 const provider={kind:'github',hasToken:true,normalize:x=>x,getSourceBranchSha:async()=>sourceSha,getTargetBranchSha:async()=>{targetReadCount++;if(targetReadError&&targetReadCount>1)throw targetReadError;return remoteTargetSha;},findOpenChangeRequest:async()=>existing,
 createChangeRequest:async()=>{calls.push('create');afterWrite();return writeResult===undefined?normal:writeResult;},
 updateChangeRequest:async()=>{calls.push('update');afterWrite();return writeResult===undefined?normal:writeResult;},
 getChangeRequest:async()=>{calls.push('read');if(readResult instanceof Error)throw readResult;return readResult===undefined?normal:readResult;},
 addLabels:async()=>{calls.push('labels');if(targetShaAfterLabels!==undefined)remoteTargetSha=targetShaAfterLabels;}};
 const config={sourceRemote:'origin',targetRemote:'origin',targetBranch:'main',requirePushedHead:false,requireFreshTarget:false,managedSections:false,labels:['test']};
 return{git,provider,config,calls,head,target,normal,targetReads:()=>targetReadCount,setRemoteTargetSha:value=>{remoteTargetSha=value;}};
}
test('create/update rejects a known source mismatch before any provider write even with advisory preview policy',async()=>{
 const {createOrUpdateDelivery}=require('../src/workflow');
 const fixture=deliveryFixture({sourceSha:'d'.repeat(40)});
 await assert.rejects(()=>createOrUpdateDelivery(fixture),{code:'ESTALE'});
 assert.deepEqual(fixture.calls,[]);
});
test('an existing change with an unknown head after readback cannot be updated',async()=>{
 const {createOrUpdateDelivery}=require('../src/workflow');
 const missing={number:1,headSha:'',url:'https://github.com/o/r/pull/1'};
 const fixture=deliveryFixture({existing:missing,readResult:missing});
 await assert.rejects(()=>createOrUpdateDelivery(fixture),error=>error.code==='ESTALE'&&!error.remoteMutationPossible);
 assert.deepEqual(fixture.calls,['read']);
});
test('unknown head after a remote write stops additional labels and reports possible mutation',async()=>{
 const {createOrUpdateDelivery}=require('../src/workflow');
 const missing={number:1,headSha:'',url:'https://github.com/o/r/pull/1'};
 const fixture=deliveryFixture({writeResult:missing,readResult:missing});
 await assert.rejects(()=>createOrUpdateDelivery({...fixture,expectedChange:null}),error=>error.code==='ESTALEAFTERMUTATION'&&error.remoteMutationPossible===true);
 assert.deepEqual(fixture.calls,['create','read']);
});
test('confirmation for a create cannot update a newly appeared change',async()=>{
 const {createOrUpdateDelivery}=require('../src/workflow');
 const original=deliveryFixture();
 const fixture=deliveryFixture({existing:original.normal});
 await assert.rejects(()=>createOrUpdateDelivery({...fixture,expectedChange:null}),{code:'ECHANGEIDENTITY'});
 assert.deepEqual(fixture.calls,[]);
});
test('matching identity permits create and final readback; failed readback reports uncertainty',async()=>{
 const {createOrUpdateDelivery}=require('../src/workflow');
 const fixture=deliveryFixture();
 const result=await createOrUpdateDelivery({...fixture,expectedChange:null,expectedTargetSha:fixture.target});
 assert.equal(result.action,'created');assert.equal(result.change.headSha,fixture.head);assert.deepEqual(fixture.calls,['create','labels','read']);
 const fail=deliveryFixture({readResult:new Error('readback timeout')});
 await assert.rejects(()=>createOrUpdateDelivery(fail),error=>error.code==='ESTALEAFTERMUTATION'&&error.remoteMutationPossible);
 assert.deepEqual(fail.calls,['create','labels','read']);
});

test('target branch movement during the remote write is detected before labels',async()=>{
 const {createOrUpdateDelivery}=require('../src/workflow');
 const fixture=deliveryFixture({targetShaAfterWrite:'d'.repeat(40)});
 await assert.rejects(()=>createOrUpdateDelivery({...fixture,expectedChange:null,expectedTargetSha:fixture.target}),error=>
  error.code==='ESTALEAFTERMUTATION'&&error.remoteMutationPossible===true&&
  error.expectedTargetSha===fixture.target&&error.actualTargetSha==='d'.repeat(40));
 assert.deepEqual(fixture.calls,['create']);
 assert.equal(fixture.targetReads(),2);
});

test('missing target branch readback after a remote write fails closed',async()=>{
 const {createOrUpdateDelivery}=require('../src/workflow');
 const fixture=deliveryFixture({targetShaAfterWrite:''});
 await assert.rejects(()=>createOrUpdateDelivery({...fixture,expectedChange:null}),error=>
  error.code==='ESTALEAFTERMUTATION'&&error.remoteMutationPossible===true&&error.actualTargetSha==='');
 assert.deepEqual(fixture.calls,['create']);
});

test('target branch movement after labels is caught by the final readback',async()=>{
 const {createOrUpdateDelivery}=require('../src/workflow');
 const fixture=deliveryFixture({targetShaAfterLabels:'e'.repeat(40)});
 await assert.rejects(()=>createOrUpdateDelivery({...fixture,expectedChange:null}),error=>
  error.code==='ESTALEAFTERMUTATION'&&error.remoteMutationPossible===true&&error.actualTargetSha==='e'.repeat(40));
 assert.deepEqual(fixture.calls,['create','labels','read']);
 assert.equal(fixture.targetReads(),3);
});

test('target branch read failure after a remote write is reported as uncertain',async()=>{
 const {createOrUpdateDelivery}=require('../src/workflow');
 const cause=new Error('target ref read timed out');
 const fixture=deliveryFixture({targetReadError:cause});
 await assert.rejects(()=>createOrUpdateDelivery({...fixture,expectedChange:null}),error=>
  error.code==='ESTALEAFTERMUTATION'&&error.remoteMutationPossible===true&&error.cause===cause);
 assert.deepEqual(fixture.calls,['create']);
});
