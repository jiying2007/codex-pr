'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { inferTitle, renderSummary, classifyChange, renderRollback } = require('../src/narrative');
test('deterministic narrative reuses commit evidence and does not need model input',()=>{ const commits=[{sha:'123456789',subject:'feat(audio): improve runtime'},{sha:'abcdef123',subject:'test: add coverage'}]; assert.equal(inferTitle(commits),'feat(audio): improve runtime (+1 commits)'); const body=renderSummary({commits,changedFiles:[{status:'M',path:'a'},{status:'A',path:'b'}]}); assert.match(body,/2 commits/); assert.match(body,/Added: 1/); });
test('path-based risk identifies migrations without fabricating runtime claims',()=>{ const risk=classifyChange([{status:'A',path:'db/migrations/001.sql'},{status:'M',path:'src/a.js'}]); assert.equal(risk.risk,'high'); assert.match(renderRollback(risk),/Git revert alone may be insufficient/); });
