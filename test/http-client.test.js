'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const{HttpClient,nextPage,retryAfterMs}=require('../src/http-client');function headers(values={}){return{get:k=>values[k.toLowerCase()]||''};}
test('pagination follows X-Next-Page and Link',()=>{assert.equal(nextPage(headers({'x-next-page':'3'}),2),3);assert.equal(nextPage(headers({link:'<https://api.example/items?page=4>; rel="next"'}),3),4);assert.equal(nextPage(headers(),1),0);});
test('SCM fetches disable automatic redirects',async()=>{const original=global.fetch;let options;global.fetch=async(_url,o)=>(options=o,{status:200,headers:headers(),text:async()=>'{"ok":true}'});try{const c=new HttpClient({baseUrl:'https://gitlab.local/api/v4'});await c.request('GET','/version');assert.equal(options.redirect,'error');}finally{global.fetch=original;}});
test('GET retries transient responses but mutation does not retry',async()=>{const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;return calls===1?{status:503,headers:headers(),text:async()=>''}:{status:200,headers:headers(),text:async()=>'{"ok":true}'}};try{const c=new HttpClient({baseUrl:'https://gitlab.local/api/v4',getRetries:1});await c.request('GET','/version');assert.equal(calls,2);}finally{global.fetch=original;}assert.equal(retryAfterMs('0'),0);});
test('SCM response bodies are bounded by streamed bytes',async()=>{const original=global.fetch;const chunk=new Uint8Array(70*1024);global.fetch=async()=>({status:200,headers:headers(),body:new ReadableStream({start(controller){controller.enqueue(chunk);controller.close();}}),text:async()=>{throw new Error('stream reader should be used');}});try{const c=new HttpClient({baseUrl:'https://gitlab.local/api/v4',maxResponseBytes:64*1024});await assert.rejects(()=>c.request('GET','/version'),error=>error.code==='ESCMOUTPUT'&&error.limitBytes===64*1024);}finally{global.fetch=original;}});

test('oversized provider Retry-After defers immediately instead of hanging the editor or retrying early',async()=>{
 const original=global.fetch;let calls=0;
 global.fetch=async()=>{calls++;return {status:429,headers:headers({'retry-after':retryHint}),text:async()=>''};};
 let retryHint='';
 try{
  const client=new HttpClient({baseUrl:'https://gitlab.local/api/v4',getRetries:3,timeoutMs:30000});
  for(const hint of ['86400',new Date(Date.now()+3600000).toUTCString(),'1e308']){
   retryHint=hint;calls=0;
   await assert.rejects(()=>client.request('GET','/version'),error=>error.code==='ESCMRETRYDEFER'&&error.status===429);
   assert.equal(calls,1,'do not hammer a throttled provider before its requested retry time');
  }
 }finally{global.fetch=original;}
});
test('short Retry-After still permits a bounded successful GET retry',async()=>{
 const original=global.fetch;let calls=0;
 global.fetch=async()=>{
  calls++;
  return calls===1?{status:503,headers:headers({'retry-after':'0.001'}),text:async()=>''}:
   {status:200,headers:headers(),text:async()=>'{"ok":true}'};
 };
 try{
  const client=new HttpClient({baseUrl:'https://gitlab.local/api/v4',getRetries:1});
  assert.equal((await client.request('GET','/version')).data.ok,true);
  assert.equal(calls,2);
 }finally{global.fetch=original;}
});
test('caller cancellation interrupts SCM backoff and never replays a canceled request',async()=>{
 const original=global.fetch;let calls=0;
 global.fetch=async()=>{
  calls++;
  return {status:503,headers:headers({'retry-after':'0.5'}),text:async()=>''};
 };
 try{
  const client=new HttpClient({baseUrl:'https://gitlab.local/api/v4',getRetries:2});
  const controller=new AbortController();
  const waiting=client.request('GET','/version',{signal:controller.signal});
  setTimeout(()=>controller.abort(),15);
  await assert.rejects(waiting,error=>error.code==='ESCMABORT');
  assert.equal(calls,1,'the canceled transport must not receive another request');
  const alreadyAborted=new AbortController();alreadyAborted.abort();
  await assert.rejects(()=>client.request('GET','/version',{signal:alreadyAborted.signal}),error=>error.code==='ESCMABORT');
  assert.equal(calls,1,'an aborted signal must prevent the first fetch');
 }finally{global.fetch=original;}
});
