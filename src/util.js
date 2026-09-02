'use strict';
const net=require('node:net');
const{sha256,canonicalJson}=require('./codex-safe-core/semantic-review');
function unique(values){return[...new Set((values||[]).filter(Boolean))];}
function normalizeBranch(value){return String(value||'').trim().replace(/^refs\/heads\//,'');}
function truncate(value,max){const s=String(value||'');return s.length<=max?s:`${s.slice(0,Math.max(0,max-1))}…`;}
function isPrivateIpLiteral(value){
  const host=String(value||'').trim().toLowerCase().replace(/^\[|\]$/g,'');
  const version=net.isIP(host);
  if(!version)return null;
  if(version===4){
    const parts=host.split('.').map(Number),[a,b]=parts;
    return a===10||a===127||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127);
  }
  return host==='::1'||host==='::'||/^f[cd]/.test(host)||/^fe[89ab]/.test(host);
}
function assertSafeUrl(value,allowInsecureHttp=false){
  const url=new URL(value);
  if(url.protocol!=='https:'&&url.protocol!=='http:')throw Object.assign(new Error(`Refusing unsupported SCM URL protocol: ${url.protocol}`),{code:'EINSECURESCM'});
  if(url.protocol==='http:'){
    if(!allowInsecureHttp)throw Object.assign(new Error(`Refusing insecure SCM URL: ${url.origin}`),{code:'EINSECURESCM'});
    if(isPrivateIpLiteral(url.hostname)===false)throw Object.assign(new Error(`Refusing plaintext SCM credentials to public IP ${url.hostname}; HTTP opt-in is restricted to trusted internal/private IPs or explicitly named internal hosts.`),{code:'EPUBLICPLAINTEXTSCM'});
  }
  if(url.username||url.password)throw Object.assign(new Error('SCM URL must not embed credentials'),{code:'EEMBEDDEDCREDENTIALS'});
  return url;
}
function stableJson(value){return canonicalJson(value);}
module.exports={sha256,canonicalJson,stableJson,unique,normalizeBranch,truncate,isPrivateIpLiteral,assertSafeUrl};
