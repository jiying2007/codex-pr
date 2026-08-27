#!/usr/bin/env python3
import json, pathlib
root=pathlib.Path('.')
CORE='c59a036cdb0b5839fe0e794031d38fd274bc116b'
OLD='a4a8acab6565bdb7e5f7927d2a4db14d31a6e895'

def read(p): return (root/p).read_text()
def write(p,s): (root/p).write_text(s)
def rep(p,a,b):
    s=read(p)
    if a not in s: raise SystemExit(f'missing marker in {p}: {a[:90]}')
    write(p,s.replace(a,b,1))
def loadj(p): return json.loads(read(p))
def savej(p,o): write(p,json.dumps(o,ensure_ascii=False,indent=2)+'\n')

# User execution profile; repository policy schema remains unchanged.
policy=read('src/policy.js')
if 'resolveReviewProfile' not in policy:
    policy=policy.replace("const { readPolicySectionAtHead } = require('./codex-safe-core/policy');","const { readPolicySectionAtHead } = require('./codex-safe-core/policy');\nconst { resolveReviewProfile } = require('./codex-safe-core/quality-platform');")
    marker="  if (model.length > 128 || /[\\r\\n\\0]/.test(model)) throw new Error('safeCodexPr.model is invalid.');\n"
    policy=policy.replace(marker,marker+"\n  const profile = resolveReviewProfile(String(getUserOnlySetting(config, 'profile', 'standard') || 'standard'));\n",1)
    policy=policy.replace('    model,\n    language,','    model,\n    profile: profile.name,\n    profileConfig: profile,\n    language,',1)
write('src/policy.js',policy)

# Impact Evidence collected from immutable HEAD blobs.
ext=read('extension.js')
if "./src/quality" not in ext:
    ext=ext.replace("const { previewHtml } = require('./src/preview');","const { previewHtml } = require('./src/preview');\nconst { collectPrImpactEvidence } = require('./src/quality');")
old="""        const context = await collectPrContext(root, baseRef, options, token);
        const afterCollection = await repositoryIdentity(root, baseRef, token);
"""
new="""        const context = await collectPrContext(root, baseRef, options, token);
        const impact = await collectPrImpactEvidence(root, context.diff, options.profileConfig, token);
        context.impact = impact;
        const afterCollection = await repositoryIdentity(root, baseRef, token);
"""
if old in ext: ext=ext.replace(old,new,1)
write('extension.js',ext)

codex=read('src/codex.js')
if "quality-platform" not in codex:
    codex=codex.replace("const { scoreEvidenceRisk, adaptiveBudget, selectModel } = require('./codex-safe-core/efficiency-planner');","const { scoreEvidenceRisk, adaptiveBudget, selectModel } = require('./codex-safe-core/efficiency-planner');\nconst { resolveReviewProfile } = require('./codex-safe-core/quality-platform');")
codex=codex.replace("  const prompt = buildPrompt(options, context, previousResult);","  const profile = options.profileConfig || resolveReviewProfile(options.profile || 'standard');\n  const prompt = `${buildPrompt(options, context, previousResult)}\\n\\nExecution profile: ${profile.name}; focus categories: ${profile.focusCategories.join(', ')}.`;",1)
codex=codex.replace("  const contextBudgetBytes = adaptiveBudget(options.maxDiffBytes, riskScore, { lowFactor: 0.4, mediumFactor: 0.7, min: 24 * 1024 });","  const adaptiveContextBudget = adaptiveBudget(options.maxDiffBytes, riskScore, { lowFactor: 0.4, mediumFactor: 0.7, min: 24 * 1024 });\n  const contextBudgetBytes = Math.max(4096, Math.floor(adaptiveContextBudget * profile.contextFactor));",1)
codex=codex.replace("  const input = buildCodexInput(prompt, plannedContext, previousResult);","  const baseInput = buildCodexInput(prompt, plannedContext, previousResult);\n  const impactText = String(context.impact?.text || '');\n  const input = impactText ? `${baseInput}\\n\\n${impactText}` : baseInput;",1)
codex=codex.replace("    maxEstimatedTokens: Number(options.maxTokenBudget) > 0 ? Number(options.maxTokenBudget) : automaticTokenBudget(options),","    maxEstimatedTokens: Math.max(12000, Math.floor((Number(options.maxTokenBudget) > 0 ? Number(options.maxTokenBudget) : automaticTokenBudget(options)) * profile.tokenFactor)),",1)
codex=codex.replace("    riskScore,\n    contextBudgetBytes,","    riskScore,\n    reviewProfile: profile.name,\n    contextBudgetBytes,\n    impactNodes: context.impact?.nodes?.length || 0,\n    impactBytes: context.impact?.bytes || 0,\n    impactTruncated: context.impact?.truncated === true,",1)
write('src/codex.js',codex)

pkg=loadj('package.json'); pkg['version']='4.1.0'
props=pkg['contributes']['configuration']['properties']
props['safeCodexPr.profile']={'type':'string','enum':['quick','standard','deep','security','embedded'],'default':'standard','scope':'application','description':'%config.profile%','enumDescriptions':['%config.profile.quick%','%config.profile.standard%','%config.profile.deep%','%config.profile.security%','%config.profile.embedded%']}
check=pkg['scripts']['check']
if 'src/quality.js' not in check: check=check.replace('node --check src/codex.js','node --check src/codex.js && node --check src/quality.js')
if 'src/codex-safe-core/quality-platform.js' not in check: check=check.replace('node --check src/codex-safe-core/context-builder.js','node --check src/codex-safe-core/context-builder.js && node --check src/codex-safe-core/quality-platform.js')
pkg['scripts']['check']=check
savej('package.json',pkg)

for p,zh in [('package.nls.json',False),('package.nls.zh-cn.json',True)]:
    data=loadj(p)
    data['config.profile']='PR 执行 Profile；在现有安全/预算上限内调整证据深度。' if zh else 'PR execution profile; adjusts evidence depth within existing safety and budget caps.'
    vals={'quick':'快速、最小证据','standard':'标准平衡','deep':'深度影响分析','security':'安全优先','embedded':'嵌入式/并发/资源优先'} if zh else {'quick':'Quick minimal evidence','standard':'Balanced standard PR','deep':'Deep impact analysis','security':'Security-focused PR','embedded':'Embedded/concurrency/resource-focused PR'}
    for k,v in vals.items(): data[f'config.profile.{k}']=v
    savej(p,data)

rep('.codex-safe.example.json',OLD,CORE)
h=read('scripts/hardening.test.js').replace(OLD,CORE).replace("assert.strictEqual(pkg.version, '4.0.2');","assert.strictEqual(pkg.version, '4.1.0');")
h=h.replace('Safe Core v4.3 efficiency commit','Safe Core v4.4 quality-platform commit').replace('Family v4.3 hardening','Family v4.4 hardening')
h=h.replace("assert.strictEqual(typeof core.estimateRequestTokens, 'function');","assert.strictEqual(typeof core.estimateRequestTokens, 'function');\nassert.strictEqual(typeof core.buildImpactEvidenceGraph, 'function');\nassert.strictEqual(pkg.contributes.configuration.properties['safeCodexPr.profile'].default, 'standard');")
h=h.replace("for (const field of ['safeCoreVersion', 'safeContractVersion', 'policySchemaVersion', 'promptContractVersion', 'codexVersion', 'requestedModel', 'resolvedModel', 'riskScore', 'contextBudgetBytes', 'requestEstimate', 'usage', 'durationMs'])","for (const field of ['safeCoreVersion', 'safeContractVersion', 'policySchemaVersion', 'promptContractVersion', 'codexVersion', 'requestedModel', 'resolvedModel', 'riskScore', 'reviewProfile', 'contextBudgetBytes', 'impactNodes', 'impactBytes', 'requestEstimate', 'usage', 'durationMs'])")
write('scripts/hardening.test.js',h)

b=read('scripts/build.js').replace("'codex.js', 'preview.js', 'github-pr-provider.js'","'codex.js', 'quality.js', 'preview.js', 'github-pr-provider.js'")
b=b.replace("'git-repository.js', 'context-builder.js', 'efficiency-planner.js', 'policy.js'","'git-repository.js', 'context-builder.js', 'efficiency-planner.js', 'quality-platform.js', 'policy.js'")
write('scripts/build.js',b)

ch=read('CHANGELOG.md')
if '## 4.1.0 - 2026-08-27' not in ch:
    ch=ch.replace('## Unreleased\n','## Unreleased\n\n## 4.1.0 - 2026-08-27\n\n- Adopt Safe Core 4.4 Quality Platform with user execution profiles and bounded Impact Evidence sourced from immutable HEAD blobs.\n- Keep deterministic Testing/review-evidence sections and existing Safe Contract v2, Policy Schema v3 and PR Prompt Contract v1 semantics unchanged.\n',1)
write('CHANGELOG.md',ch)
