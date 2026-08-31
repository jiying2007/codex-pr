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
