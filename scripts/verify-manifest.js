'use strict';

// Keep the required CI dependency bound to real SARIF, including failed uploads.
{
  const assert = require('node:assert/strict');
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');
  const helper = 'src/codex-safe-core/scripts/codeql-findings-gate.js';
  function job(text, name) {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const start = lines.indexOf('  ' + name + ':');
    assert.ok(start >= 0, 'missing required workflow job: ' + name);
    let end = start + 1;
    while (end < lines.length && !/^  [A-Za-z0-9_-]+:/.test(lines[end])) end++;
    return lines.slice(start, end).join('\n');
  }
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/codeql.yml'), 'utf8');
  const analysisJob = job(workflow, 'analyze');
  assert.ok(!analysisJob.includes('continue-on-error:'), 'CodeQL failures must remain fatal');
  const steps = analysisJob.split('\n      - ').slice(1).map(block => block.split('\n').map(line => line.trim()));
  function action(name) {
    const matches = steps.filter(lines => lines.some(line => line.startsWith('uses: ' + name + '@')));
    assert.equal(matches.length, 1, 'expected exactly one ' + name + ' step');
    return matches[0];
  }
  assert.ok(action('actions/checkout').includes('submodules: recursive'), 'canonical Core must be checked out');
  assert.ok(action('actions/setup-node').includes("node-version: '24.19.0'"), 'SARIF gate must use supported Node 24.19.0');
  const analyze = action('github/codeql-action/analyze');
  assert.ok(analyze.includes('output: codeql-results'), 'analyze must produce the gated report directory');
  assert.ok(analyze.includes('upload: always'), 'GitHub code scanning upload must stay enabled');
  const findings = steps.filter(lines => lines.includes('run: node ' + helper + ' codeql-results'));
  assert.equal(findings.length, 1, 'the production Core SARIF gate must run exactly once');
  assert.ok(findings[0].includes('if: ${{ always() }}'), 'findings gate must run even when analyze/upload fails');
  assert.ok(steps.indexOf(findings[0]) > steps.indexOf(analyze), 'findings gate must inspect the actual analyze output');
  const evidence = action('actions/upload-artifact');
  assert.ok(evidence.includes('if: ${{ always() }}'), 'SARIF evidence must survive failures');
  assert.ok(evidence.includes('uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2'), 'SARIF artifact action must retain its audited exact pin');
  assert.ok(evidence.includes('name: codeql-sarif-${{ github.run_id }}-${{ github.run_attempt }}'), 'SARIF evidence must bind the run and attempt');
  assert.ok(evidence.includes('path: codeql-results/*.sarif'), 'preserve precisely the analyzed SARIF files');
  assert.ok(evidence.includes('if-no-files-found: error'), 'missing SARIF evidence must fail closed');
  assert.ok(steps.indexOf(evidence) > steps.indexOf(analyze), 'SARIF evidence must come from the current analysis');
  const ci = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
  const caller = job(ci, 'codeql');
  assert.ok(caller.includes('uses: ./.github/workflows/codeql.yml'), 'CI must invoke the checked CodeQL workflow');
  assert.ok(!caller.includes('continue-on-error:'), 'CI must retain CodeQL failure propagation');
  for (const permission of ['actions: read', 'contents: read', 'security-events: write']) {
    assert.ok(analysisJob.includes(permission) && caller.includes(permission), 'CodeQL caller/callee permission missing: ' + permission);
  }
  const required = job(ci, 'ci-gate').split('\n').map(line => line.trim());
  const needs = required.find(line => line.startsWith('needs: [') && line.endsWith(']'));
  assert.ok(needs && needs.slice(8, -1).split(',').map(value => value.trim()).includes('codeql'),
    'required CI Gate must depend on the checked CodeQL workflow');
  assert.ok(required.includes('if: ${{ always() }}'), 'required CI Gate must still evaluate failed dependencies');
}

const fs=require('node:fs'),cp=require('node:child_process'),pkg=require('../package.json'),contract=require('../product-contract.json');function fail(m){console.error(m);process.exitCode=1;}
if(pkg.name!=='codex-change-safe')fail('package name must be codex-change-safe');if(pkg.version!==contract.productVersion)fail('package/product contract version mismatch');if(contract.productContractVersion!==2||contract.productId!=='codex-change-safe')fail('Family Product Contract v2 identity mismatch');if(contract.safeCoreMajorVersion!==4||contract.safeContractVersion!==2||contract.policySchemaVersion!==4)fail('Family protocol identity mismatch');const props=pkg.contributes?.configuration?.properties||{};if(!Object.keys(props).every(k=>k.startsWith('safeCodexChange.')))fail('legacy/noncanonical settings namespace found');if(JSON.stringify(pkg).includes('safeCodexPr'))fail('legacy safeCodexPr compatibility residue found');if(props['safeCodexChange.remote'])fail('v5.1 topology must not retain ambiguous remote setting');for(const required of['safeCodexChange.sourceRemote','safeCodexChange.targetRemote','safeCodexChange.titlePolicy'])if(!props[required])fail(`missing ${required}`);
for(const raw of fs.readdirSync('src',{recursive:true}).filter(x=>String(x).endsWith('.js'))){const file=String(raw).replace(/\\/g,'/');if(file.startsWith('codex-safe-core/'))continue;const text=fs.readFileSync(`src/${raw}`,'utf8');if(/\bcodex\s+exec\b|runCodex|providerBaseUrl/.test(text))fail(`model runtime residue found in src/${file}`);}
if(contract.reviewExtensionApiContractConsumed!==2)fail('review API contract must be 2');if(contract.commitExtensionApiContractConsumed!==1)fail('commit API contract must be 1');if(contract.defaultModelCalls!==0)fail('default model calls must remain zero');if(contract.extensionApiContract!==2)fail('Change extension API contract must be 2');if(contract.authorizationGateVersion!==1)fail('authorization gate contract missing');if(contract.changePolicyFile!=='.codex-safe.json')fail('Change policy must use the canonical Family policy file');if(contract.codexRuntimeVersionConsumed!==3||contract.providerContractVersionConsumed!==3)fail('Runtime/Provider Contract v3 consumption must remain explicit');const core='190651770a444b0693d82228afc66879dd57b0c0';if(contract.safeCoreVersion!=='4.18.1'||contract.safeCoreCommit!==core)fail('family Core pin must remain exact');
try{const entry=cp.execFileSync('git',['ls-files','-s','src/codex-safe-core'],{encoding:'utf8'}).trim();if(entry!==`160000 ${core} 0\tsrc/codex-safe-core`)fail(`Safe Core gitlink mismatch: ${entry||'<missing>'}`);}catch(error){fail(`Safe Core gitlink could not be verified: ${error.message}`);}
if(!fs.existsSync('.gitmodules')||!fs.readFileSync('.gitmodules','utf8').includes('src/codex-safe-core'))fail('Safe Core submodule metadata missing');if(!fs.existsSync('.codex-safe.example.json'))fail('canonical Policy Schema v4 example missing');if(fs.existsSync('.codex-change-safe.json')||fs.existsSync('.codex-change-safe.example.json'))fail('parallel Change policy surface must not exist');try{const example=JSON.parse(fs.readFileSync('.codex-safe.example.json','utf8'));if(example.schemaVersion!==4||!example.change)fail('canonical policy example must contain schemaVersion 4 + change');if(!String(example.$schema||'').includes(core))fail('canonical policy example must pin schema provenance to Core 4.16 exact SHA');}catch(error){fail(`canonical policy example invalid: ${error.message}`);}
const readmeContracts={
  'README.md':[`- Safe Core: \`${contract.safeCoreVersion}\` exact pin \`${core}\`` ,`Codex Change Safe ${pkg.version} pins Core ${contract.safeCoreVersion}`],
  'README.zh-CN.md':[`- Safe Core：\`${contract.safeCoreVersion}\` 精确 pin \`${core}\`` ,`Codex Change Safe ${pkg.version} 固定到 Core ${contract.safeCoreVersion}`]
};
for(const[file,needles]of Object.entries(readmeContracts)){const text=fs.readFileSync(file,'utf8');for(const needle of needles)if(!text.includes(needle))fail(`${file} current identity missing: ${needle}`);}
const changelog=fs.readFileSync('CHANGELOG.md','utf8').replace(/\r\n/g,'\n');if(!changelog.startsWith(`# Changelog\n\n## ${pkg.version}`))fail('CHANGELOG must start with the current product version under the top-level heading');
if(!process.exitCode)console.log('manifest ok');
