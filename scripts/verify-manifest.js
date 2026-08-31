'use strict';
const fs=require('node:fs'); const pkg=require('../package.json'); const contract=require('../product-contract.json');
function fail(message){ console.error(message); process.exitCode=1; }
if(pkg.name!=='codex-change-safe') fail('package name must be codex-change-safe');
if(pkg.version!==contract.productVersion) fail('package/product contract version mismatch');
if(!Object.keys(pkg.contributes?.configuration?.properties||{}).every(k=>k.startsWith('safeCodexChange.'))) fail('legacy/noncanonical settings namespace found');
if(JSON.stringify(pkg).includes('safeCodexPr')) fail('legacy safeCodexPr compatibility residue found');
for(const file of fs.readdirSync('src',{recursive:true}).filter(x=>String(x).endsWith('.js'))){ const text=fs.readFileSync(`src/${file}`,'utf8'); if(/\bcodex\s+exec\b|runCodex|providerBaseUrl/.test(text)) fail(`model runtime residue found in src/${file}`); }
if(contract.reviewExtensionApiContractConsumed!==2) fail('review extension API contract must be 2');
if(contract.commitExtensionApiContractConsumed!==1) fail('commit extension API contract must be 1');
if(contract.defaultModelCalls!==0) fail('default model calls contract must remain zero');
if(!process.exitCode) console.log('manifest ok');
