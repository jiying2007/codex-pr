'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { runPreflight } = require('../src/preflight');
function fakeGit({status='',localTarget='targetsha'}={}) { return { currentBranch:async()=> 'feat/x', revParse:async ref=>ref==='HEAD'?'headsha':localTarget, remoteUrl:async()=> 'git@github.com:o/r.git', trackingRef:(r,b)=>`${r}/${b}`, mergeBase:async()=> 'base', commits:async()=>[{sha:'c1',subject:'feat: x'}], changedFiles:async()=>[{status:'M',path:'src/a.js'}], statusPorcelain:async()=>status, upstream:async()=> 'origin/feat/x', showFile:async()=>'' }; }
const config={remote:'origin',targetBranch:'main',requireCleanWorktree:true,requirePushedHead:true,requireFreshTarget:true};
test('preflight is ready only when local and remote snapshots agree', async()=>{ const p=await runPreflight({git:fakeGit(),config,provider:{getBranchSha:async b=>b==='feat/x'?'headsha':'targetsha'}}); assert.equal(p.state,'READY'); });
test('preflight blocks dirty worktree and stale target', async()=>{ const p=await runPreflight({git:fakeGit({status:' M x'}),config,provider:{getBranchSha:async b=>b==='feat/x'?'headsha':'newtarget'}}); assert.equal(p.state,'BLOCKED'); assert.deepEqual(new Set(p.blockers.map(x=>x.code)), new Set(['dirty_worktree','target_ref_stale'])); });
