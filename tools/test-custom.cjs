const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const source = fs.readFileSync(process.env.SCRIPT_UNDER_TEST || 'convert-custom.js', 'utf8');
function run(names, args = {}) {
    const context = { $arguments: args };
    vm.createContext(context);
    vm.runInContext(source, context);
    const proxies = names.map((name, i) => ({name, type: 'ss', server: '127.0.0.1', port: 10000 + i, cipher: 'aes-128-gcm', password: 'test-only'}));
    return context.main({proxies});
}
function check(result) {
    const groups = result['proxy-groups'];
    const names = new Set([...result.proxies.map(p => p.name), ...groups.map(g => g.name), 'DIRECT', 'REJECT', 'REJECT-DROP', 'COMPATIBLE', 'PASS']);
    assert.equal(new Set(groups.map(g => g.name)).size, groups.length);
    for (const g of groups) {
        for (const p of g.proxies || []) assert(names.has(p), 'Missing member: ' + p);
        assert(!g.proxies?.includes(g.name), 'Self reference: ' + g.name);
    }
    for (const rule of result.rules) {
        const p = rule.split(',');
        assert(names.has(p.at(-1) === 'no-resolve' ? p.at(-2) : p.at(-1)), 'Missing rule target: ' + rule);
    }
    for (const name of ['Youtube','Netflix','苹果服务','谷歌服务','广告拦截','低倍率节点','Tailscale']) assert(!groups.some(g => g.name === name));
    const byName = new Map(groups.map(g => [g.name, g]));
    function visit(name, stack) {
        assert(!stack.includes(name), 'Group cycle: ' + [...stack,name].join(' -> '));
        for (const child of byName.get(name)?.proxies || []) if (byName.has(child)) visit(child, [...stack,name]);
    }
    for (const name of byName.keys()) visit(name, []);
}
let count = 0;
for (const grouptype of [0, 1, 2]) for (const regex of [false, true]) {
    const result = run(['香港 01','香港 02','美国 自建 01','美国 02','未知 自建 03'], {grouptype, regex});
    check(result);
    assert.equal(result['proxy-groups'].find(g => g.name === '美国节点').type, ['select','url-test','load-balance'][grouptype]);
    assert.deepEqual(Array.from(result['proxy-groups'].find(g => g.name === '自建').proxies), ['美国 自建 01','未知 自建 03']);
    count++;
}
const noSelf = run(['日本 01','日本 02']);
check(noSelf);
assert.equal(noSelf['proxy-groups'].find(g => g.name === '自建').proxies[0], 'DIRECT'); count++;
const custom = run(['US private 01','US 02'], {selftag: 'private', threshold: 1}); check(custom); count++;
assert.throws(() => run(['自建']), /冲突/); count++;
assert.throws(() => run(['US 01'], {selftag: '['})); count++;
assert.throws(() => run(['US 01'], {selftag: ''})); count++;
assert.throws(() => run(['US 01','US 01']), /重复/); count++;
assert.throws(() => run(['Telegram']), /冲突/); count++;
assert.throws(() => run(['US 01'], {threshold: -1}), /threshold/); count++;
assert.throws(() => run(['US 01'], {grouptype: 3}), /grouptype/); count++;
const empty = run([]); check(empty); count++;
const single = run(['A-mitceHK-1','A-mitceUS-1TCP','B-SNTP-🇺🇦 UKR01','B-SNTP-🇻🇳 VN01']);
check(single);
for (const name of ['香港节点','美国节点','乌克兰节点','越南节点']) assert(single['proxy-groups'].some(g => g.name === name)); count++;
const high = run(['A-mitceHK-1','A-mitceHK-2','JP 01'], {threshold:2}); check(high);
assert(!high['proxy-groups'].some(g => g.name === '日本节点')); count++;
fs.writeFileSync('tools/custom-test-config.json', JSON.stringify(run(['香港 01','香港 02','美国 自建 01','美国 02']), null, 2));
console.log('Passed ' + count + ' cases; group and rule references valid.');
