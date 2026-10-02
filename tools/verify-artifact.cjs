// 对指定脚本运行回归测试，随后以测试节点生成配置并调用真实 Mihomo 核心。
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm'), assert = require('assert/strict');
const script = path.resolve(process.argv[2] || 'convert-custom.js');
const core = process.argv[3] && path.resolve(process.argv[3]);
const env = {...process.env,SCRIPT_UNDER_TEST:script};
for (const test of ['tools/test-custom.cjs','tools/test-fixture.cjs']) {
    const r = cp.spawnSync(process.execPath,[test],{env,encoding:'utf8'});
    if (r.status !== 0) {process.stdout.write(r.stdout);process.stderr.write(r.stderr);process.exit(1);}
}
console.log('Regression: 18 cases + 113-name fixture passed');
if (!core) {console.log('Core check omitted: provide Mihomo executable as second argument');process.exit(0);}
const names = JSON.parse(fs.readFileSync('tests/node-names.json','utf8'));
const folder = path.resolve('tools/artifact-core-check');
fs.mkdirSync(folder,{recursive:true});
for (const grouptype of [0,1,2]) for (const regex of [false,true]) {
    const context = {$arguments:{grouptype,regex}};
    vm.createContext(context);vm.runInContext(fs.readFileSync(script,'utf8'),context);
    const proxies = names.map((name,i)=>({name,type:'ss',server:'127.0.0.1',port:10000+i,cipher:'aes-128-gcm',password:'test-only'}));
    const config = context.main({proxies});
    assert.strictEqual(config.proxies,proxies,'Original proxy data must be retained');
    const file = path.join(folder,`config-${grouptype}-${regex}.json`);
    fs.writeFileSync(file,JSON.stringify(config,null,2));
    const r = cp.spawnSync(core,['-t','-d',path.resolve('tools'),'-f',file],{encoding:'utf8',timeout:60000});
    if (r.status !== 0) {process.stdout.write(r.stdout || '');process.stderr.write(r.stderr || '');process.exit(1);}
    console.log(`Mihomo config check passed: grouptype=${grouptype}, regex=${regex}`);
}
