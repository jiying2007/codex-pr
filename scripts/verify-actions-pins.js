'use strict';
const fs=require('node:fs'); const path=require('node:path');
const root=path.join(__dirname,'..','.github','workflows'); let failed=false;
for(const file of fs.readdirSync(root).filter(x=>/\.ya?ml$/.test(x))){ const text=fs.readFileSync(path.join(root,file),'utf8'); for(const m of text.matchAll(/\buses:\s*([^\s#]+)@([^\s#]+)/g)){ const ref=m[2]; if(!/^[0-9a-f]{40}$/.test(ref)){ console.error(`${file}: action is not commit-pinned: ${m[1]}@${ref}`); failed=true; } } }
if(failed) process.exit(1); console.log('actions pins ok');
