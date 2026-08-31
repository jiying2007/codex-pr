'use strict';
const path=require('node:path');
async function main(){const{runTests,downloadAndUnzipVSCode}=require('@vscode/test-electron');const extensionDevelopmentPath=path.resolve(__dirname,'../..');const extensionTestsPath=path.resolve(__dirname,'suite/index');const version=process.env.VSCODE_TEST_VERSION||'stable';const vscodeExecutablePath=await downloadAndUnzipVSCode(version);await runTests({vscodeExecutablePath,extensionDevelopmentPath,extensionTestsPath,launchArgs:['--disable-extensions']});}
main().catch(e=>{console.error(e);process.exit(1)});
