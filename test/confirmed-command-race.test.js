'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');

function harness(){
  const shaA='a'.repeat(40),shaB='b'.repeat(40),targetSha='c'.repeat(40);
  let branch='topic-a',approved=null,shownResolve,mutationCalls=[];
  const shown=new Promise(resolve=>shownResolve=resolve);
  const callbacks=new Map(),errors=[];
  const remote={host:'github.com',projectPath:'fixture/repo',scheme:'https',webOrigin:'https://github.com'};
  const raw=which=>({number:which==='topic-a'?1:2,html_url:'https://github.com/fixture/repo/pull/'+(which==='topic-a'?1:2),sourceBranch:which,headSha:which==='topic-a'?shaA:shaB});
  const provider={
    kind:'github',hasToken:true,sourceRemote:remote,targetRemote:remote,
    findOpenChangeRequest:async which=>raw(which),
    normalize:item=>({number:item.number,url:item.html_url,sourceBranch:item.sourceBranch,targetBranch:'main',headSha:item.headSha,raw:item}),
    enableAutoMerge:async item=>mutationCalls.push(['auto',item.number]),
    markReady:async item=>mutationCalls.push(['ready',item.number]),
    enqueueMergeQueue:async item=>mutationCalls.push(['queue',item.number]),
    requestReviewers:async(number)=>mutationCalls.push(['reviewers',number])
  };
  class GitCli{
    remoteUrl(){return Promise.resolve('https://github.com/fixture/repo.git')}
    remoteDefaultBranch(){return Promise.resolve('main')}
    trackingRef(){return 'origin/main'}
    revParse(name){return Promise.resolve(name==='HEAD'?(branch==='topic-a'?shaA:shaB):targetSha)}
    currentBranch(){return Promise.resolve(branch)}
  }
  const vscode={
    ProgressLocation:{Notification:1},
    workspace:{isTrusted:true,workspaceFolders:[{uri:{scheme:'file',fsPath:'/tmp/change-fixture'}}],getConfiguration:()=>({get:(_key,fallback)=>fallback})},
    extensions:{getExtension:()=>undefined},
    commands:{registerCommand:(name,cb)=>{callbacks.set(name,cb);return{dispose(){}}}},
    window:{
      createOutputChannel:()=>({appendLine(){},dispose(){}}),
      registerTreeDataProvider:()=>({dispose(){}}),
      withProgress:(_options,fn)=>fn(),
      showWarningMessage:(_detail,_modal,label)=>new Promise(resolve=>{approved=()=>resolve(label);shownResolve();}),
      showInformationMessage:()=>undefined,
      showErrorMessage:error=>errors.push(String(error))
    }
  };
  const preflight=()=>({
    state:'READY',blockers:[],warnings:[],commits:[],changedFiles:[],
    sourceBranch:branch,targetBranch:'main',sourceRemote:remote,targetRemote:remote,
    sourceRemoteName:'origin',targetRemoteName:'origin',
    headSha:branch==='topic-a'?shaA:shaB,targetSha,mergeBase:'d'.repeat(40),policySource:'fixture'
  });
  const stubs={
    'vscode':vscode,
    './src/git-cli':{GitCli},'./src/remote':{parseRemote:()=>remote},
    './src/provider-factory':{createProvider:()=>provider},
    './src/provider-discovery':{resolveProviderConfig:async(_remote,config)=>({config,kind:'github',discovery:{}}),probeProvider:async()=>({})},
    './src/codex-safe-core/display-time':{formatLogTimestamp:()=>''},
    './src/preflight':{scmFailure:error=>error},
    './src/workflow':{prepareDelivery:async()=>({preflight:preflight(),receipt:{provenance:{}},reviewers:{users:['reviewer'],teams:[]}}),
      createOrUpdateDelivery:async()=>{mutationCalls.push(['create']);throw Error('Unexpected remote create or update');}},
    './src/readiness':{evaluateReadiness:async({change})=>({change,state:'READY',checks:[],observedChecks:[],approvals:[],requiredApprovals:0,nativePolicy:{status:'ok'},blockers:[],pending:[],externalChecks:[]})},
    './src/provenance':{collectProvenance:async()=>({})},
    './src/change-receipt-store':{createChangeReceiptStore:()=>({list:()=>[]})},
    './src/delivery-tree':{DeliveryTreeProvider:class{update(){}dispose(){}}},
    './src/policy':{resolveEffectiveConfig:async(_git,config)=>config},
    './src/authorization':{authorize:()=>({decision:'ALLOW'})}
  };
  const extensionPath=require.resolve('../extension'),old=Module._load;
  Module._load=function(request,parent,isMain){
    if(parent?.filename===extensionPath&&Object.hasOwn(stubs,request))return stubs[request];
    return old.call(this,request,parent,isMain);
  };
  try{
    delete require.cache[extensionPath];
    const extension=require('../extension');
    const state={get:()=>({}),update:async()=>{}};
    extension.activate({globalState:state,subscriptions:[]});
  }finally{Module._load=old;delete require.cache[extensionPath];}
  return{
    async attempt(command){
      const dispatch=callbacks.get('safeCodexChange.'+command);
      assert.equal(typeof dispatch,'function');
      const task=dispatch();
      await shown;
      branch='topic-b';
      approved();
      await task;
      assert.deepEqual(mutationCalls,[],'confirmation for PR A may not act on PR B');
      assert.ok(errors.some(text=>text.includes('Codex Change Safe:')&&text.includes('changed')),JSON.stringify(errors));
    }
  };
}
for(const command of ['markReady','enableAutoMerge','enqueueMergeQueue','requestReviewers','createOrUpdate']){
 test('confirmed '+command+' aborts if the selected branch switches to a different PR before approval',async()=>{await harness().attempt(command);});
}
