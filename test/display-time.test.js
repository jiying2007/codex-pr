'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');const{formatLogTimestamp}=require('../src/codex-safe-core/display-time');
test('Change Safe consumes Core local display time while receipts remain independent',()=>{assert.equal(formatLogTimestamp('2026-09-02T12:00:00.000Z',{timeZone:'Asia/Singapore'}),'2026-09-02 20:00:00 UTC+08:00');const source=fs.readFileSync(require.resolve('../extension'),'utf8');assert.match(source,/formatLogTimestamp\(new Date\(\)\)/);});
