'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {assertConfirmedChange,assertConfirmedPreflight}=require('../src/confirmed-change');
const change={number:21,url:'https://github.com/example/repo/pull/21',headSha:'a'.repeat(40),sourceBranch:'topic-a',targetBranch:'main'};
const preflight={sourceBranch:'topic-a',targetBranch:'main',headSha:'a'.repeat(40),targetSha:'b'.repeat(40),mergeBase:'c'.repeat(40),
 sourceRemote:{host:'github.com',projectPath:'example/repo'},targetRemote:{host:'github.com',projectPath:'example/repo'}};
test('same immutable PR and preflight remain eligible after fresh checks',()=>{
 assert.doesNotThrow(()=>assertConfirmedChange(change,{...change}));
 assert.doesNotThrow(()=>assertConfirmedPreflight(preflight,structuredClone(preflight)));
});
test('confirmation of PR A cannot authorize PR B after switching branches',()=>{
 for(const [key,value] of [['number',22],['headSha','d'.repeat(40)],['sourceBranch','topic-b'],['targetBranch','develop'],['url','https://github.com/example/repo/pull/22']]){
  assert.throws(()=>assertConfirmedChange(change,{...change,[key]:value}),{code:'ECHANGEIDENTITY'});
 }
});
test('the appearance or disappearance of an open PR cannot convert create into update',()=>{
 assert.throws(()=>assertConfirmedChange(null,change),{code:'ECHANGEIDENTITY'});
 assert.throws(()=>assertConfirmedChange(change,null),{code:'ECHANGEIDENTITY'});
});
test('preflight changes after create/update approval require a fresh confirmation',()=>{
 for(const [key,value] of [['sourceBranch','topic-b'],['targetBranch','release'],['headSha','d'.repeat(40)],['targetSha','d'.repeat(40)],['mergeBase','d'.repeat(40)]]){
  assert.throws(()=>assertConfirmedPreflight(preflight,{...preflight,[key]:value}),{code:'ECHANGEIDENTITY'});
 }
 assert.throws(()=>assertConfirmedPreflight(preflight,{...preflight,sourceRemote:{...preflight.sourceRemote,projectPath:'other/repo'}}),{code:'ECHANGEIDENTITY'});
 assert.throws(()=>assertConfirmedPreflight(preflight,{...preflight,targetRemote:{...preflight.targetRemote,host:'internal.example'}}),{code:'ECHANGEIDENTITY'});
});
