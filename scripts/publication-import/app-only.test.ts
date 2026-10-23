import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,existsSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync,spawnSync} from 'node:child_process';
test('application-only runner skips catalog and storage actions, records completion, and refuses newer releases',()=>{
 const root=mkdtempSync(join(tmpdir(),'etalonops-ui-runner-')),python=execFileSync('python3',['-c','import sys;print(sys.executable)'],{encoding:'utf8'}).trim();
 try{
 const bin=join(root,'bin');mkdirSync(bin);mkdirSync(join(root,'node_modules'));
 writeFileSync(join(root,'run-import.sh'),readFileSync(new URL('./run-import.sh',import.meta.url)));writeFileSync(join(root,'node-cloud.sh'),'# Isolated fixture; use the instrumented PATH.\n');writeFileSync(join(root,'check-cloud.py'),'# Health call instrumented below.\n');
 const program=(name:string,body:string)=>writeFileSync(join(bin,name),'#!'+python+'\n'+body,{mode:0o755});
 program('node',`import sys,os\nif '--prepare-state' in sys.argv: print('Owner/context verified (fixture)')\nelif '--input-type=module' in sys.argv: print(os.environ['UI_TEST_RELEASE'])\nelse: raise SystemExit('Unexpected catalog/probe invocation')\n`);
 program('python3',`import sys,os\nif len(sys.argv)>1 and sys.argv[1]=='check-cloud.py':\n print('Instrumented exact-release health check')\n raise SystemExit(int(os.environ.get('UI_TEST_HEALTH_FAIL','0')))\nos.execv(${JSON.stringify(python)},[${JSON.stringify(python)}]+sys.argv[1:])\n`);
 program('az',`from pathlib import Path\nPath('unexpected-azure-call').write_text('called')\nraise SystemExit(99)\n`);
 const run=(release:string,fail='0')=>spawnSync('bash',['run-import.sh','--apply','--app-only'],{cwd:root,encoding:'utf8',env:{...process.env,PATH:bin+':'+process.env.PATH,UI_TEST_RELEASE:release,UI_TEST_HEALTH_FAIL:fail}});
 const report=()=>JSON.parse(readFileSync(join(root,'.runtime/result.json'),'utf8'));
 assert.equal(run('cms-suite-v49.4').status,0);assert.equal(report().state,'complete');assert.equal(report().catalogImport,false);assert.equal(report().release,'cms-suite-v49.4');assert.equal(existsSync(join(root,'unexpected-azure-call')),false);
 assert.notEqual(run('cms-suite-v49.5').status,0);assert.equal(report().state,'stopped');assert.ok(report().error);assert.equal(existsSync(join(root,'unexpected-azure-call')),false);
 assert.notEqual(run('cms-suite-v49.4','1').status,0);assert.equal(report().state,'stopped');assert.ok(report().error);
 }finally{rmSync(root,{recursive:true,force:true});}
});
