'use strict';
const{spawnSync}=require('node:child_process');const cmd=process.platform==='win32'?'npx.cmd':'npx';let r=spawnSync(process.execPath,['scripts/build.js'],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);r=spawnSync(cmd,['--yes','@vscode/vsce@3.9.2','package','--no-dependencies'],{stdio:'inherit'});process.exit(r.status||0);
