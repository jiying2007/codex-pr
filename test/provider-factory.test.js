'use strict';
const test=require('node:test'); const assert=require('node:assert/strict');
const { assertApiBoundToRemote }=require('../src/provider-factory');
test('SCM API token destination is bound to git remote host',()=>{ assert.equal(assertApiBoundToRemote('github',{host:'github.com'},'https://api.github.com'),'https://api.github.com'); assert.equal(assertApiBoundToRemote('gitlab',{host:'gitlab.local'},'https://gitlab.local/api/v4'),'https://gitlab.local/api/v4'); assert.throws(()=>assertApiBoundToRemote('gitlab',{host:'gitlab.local'},'https://evil.example/api/v4'),{code:'EAPIHOSTMISMATCH'}); });
