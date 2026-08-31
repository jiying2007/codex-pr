'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

test('extension activation registers the complete delivery surface and exposes a small public receipt API', () => {
  const registered = [];
  class EventEmitter { constructor(){ this.event=()=>({dispose(){}}); } fire(){} dispose(){} }
  class TreeItem { constructor(label){ this.label=label; } }
  const vscode = {
    ExtensionMode: { Production: 1 },
    EventEmitter,
    TreeItem,
    TreeItemCollapsibleState: { None: 0 },
    ThemeIcon: class { constructor(id){ this.id=id; } },
    window: { registerTreeDataProvider:()=>({dispose(){}}) },
    commands: { registerCommand:(id)=>{ registered.push(id); return {dispose(){}}; } },
    workspace: {},
    extensions: {}
  };
  const original = Module._load;
  Module._load = function(request, parent, isMain) { if (request === 'vscode') return vscode; return original.call(this, request, parent, isMain); };
  try {
    delete require.cache[require.resolve('../extension')];
    const extension = require('../extension');
    const state = { get:()=>({}), update:async()=>{} };
    const context = { globalState: state, subscriptions: [] };
    const api = extension.activate(context);
    assert.equal(api.contractVersion, 1);
    assert.equal(typeof api.getChangeReceipts, 'function');
    assert.deepEqual(registered.sort(), [
      'safeCodexChange.createOrUpdate','safeCodexChange.enableAutoMerge','safeCodexChange.enqueueMergeQueue','safeCodexChange.markReady',
      'safeCodexChange.open','safeCodexChange.preflight','safeCodexChange.refresh','safeCodexChange.requestReviewers'
    ].sort());
  } finally { Module._load = original; delete require.cache[require.resolve('../extension')]; }
});
