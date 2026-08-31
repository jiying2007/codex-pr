'use strict';
const { unique } = require('./util');
function globToRegExp(pattern) {
  let p=String(pattern||'').trim(); const anchored=p.startsWith('/'); if(anchored)p=p.slice(1); const dirOnly=p.endsWith('/'); if(dirOnly)p+='**'; let out='';
  for(let i=0;i<p.length;i++){const ch=p[i]; if(ch==='*'){if(p[i+1]==='*'){while(p[i+1]==='*')i++; out+='.*';}else out+='[^/]*';}else if(ch==='?')out+='[^/]';else out+=ch.replace(/[.+^${}()|[\]\\]/g,'\\$&');}
  return new RegExp(anchored?`^${out}$`:`(?:^|.*/)${out}$`);
}
function parseCodeowners(text) {
  const rules=[],unsupported=[];
  for(const raw of String(text||'').split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith('#'))continue;const parts=line.split(/\s+/);if(parts.length<2)continue;const pattern=parts.shift();
    const owners=parts.filter(x=>x.startsWith('@')).map(x=>x.slice(1)); const users=owners.filter(x=>!x.includes('/')); const teams=owners.filter(x=>x.includes('/'));
    if(users.length||teams.length)rules.push({pattern,users,teams,regex:globToRegExp(pattern)}); else unsupported.push({pattern,owners:parts});
  }
  rules.unsupported=unsupported; return rules;
}
function ownersForPath(path,rules){let users=[],teams=[];for(const rule of rules)if(rule.regex.test(path)){users=rule.users;teams=rule.teams;}return{users,teams};}
function suggestReviewers(paths,rules,extras=[]){const users=[...extras],teams=[];for(const path of paths){const owners=ownersForPath(path,rules);users.push(...owners.users);teams.push(...owners.teams);}return{users:unique(users),teams:unique(teams)};}
module.exports={globToRegExp,parseCodeowners,ownersForPath,suggestReviewers};
