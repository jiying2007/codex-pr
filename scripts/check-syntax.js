'use strict';
const fs=require('node:fs'); const path=require('node:path'); const cp=require('node:child_process');
const root=path.resolve(__dirname,'..'); const files=['extension.js'];
for (const dir of ['src','test','scripts']) { const walk=d=>{ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()) walk(p); else if(e.isFile()&&p.endsWith('.js')) files.push(path.relative(root,p)); } }; walk(path.join(root,dir)); }
for(const file of files){ const r=cp.spawnSync(process.execPath,['--check',file],{cwd:root,stdio:'inherit'}); if(r.status!==0) process.exit(r.status||1); }
console.log(`syntax ok: ${files.length} files`);
