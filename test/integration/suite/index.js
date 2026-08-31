'use strict';
const assert=require('node:assert/strict');const vscode=require('vscode');
async function run(){const ext=vscode.extensions.getExtension('jiying2007.codex-change-safe');assert.ok(ext,'extension must be discoverable');const api=ext.isActive?ext.exports:await ext.activate();assert.equal(api.contractVersion,2);const commands=await vscode.commands.getCommands(true);for(const id of['safeCodexChange.preflight','safeCodexChange.createOrUpdate','safeCodexChange.refresh','safeCodexChange.doctor'])assert.ok(commands.includes(id),`${id} must be registered`);}
module.exports={run};
