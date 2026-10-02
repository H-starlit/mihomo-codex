const fs = require('fs');
const upstream = fs.readFileSync('tools/override-reference.js', 'utf8');
const regions = [
 ['香港','HK','HKG','Hong Kong','🇭🇰'],['台湾','TW','TWN','Taiwan','🇹🇼'],
 ['新加坡','SG','SGP','Singapore','🇸🇬'],['日本','JP','JPN','Japan','🇯🇵'],
 ['韩国','KR','KOR','Korea','🇰🇷'],['美国','US','USA','United States','🇺🇸'],
 ['加拿大','CA','CAN','Canada','🇨🇦'],['英国','UK','GBR','United Kingdom','🇬🇧'],
 ['德国','DE','DEU','Germany','🇩🇪'],['法国','FR','FRA','France','🇫🇷'],
 ['澳大利亚','AU','AUS','Australia','🇦🇺'],['澳门','MO','MAC','Macau','🇲🇴'],
 ['马来西亚','MY','MYS','Malaysia','🇲🇾'],['越南','VN','VNM','Vietnam','🇻🇳'],
 ['阿联酋','AE','ARE','United Arab Emirates','🇦🇪'],['土耳其','TR','TUR','Turkey','🇹🇷'],
 ['尼日利亚','NG','NGA','Nigeria','🇳🇬'],['乌克兰','UA','UKR','Ukraine','🇺🇦'],
 ['巴基斯坦','PK','PAK','Pakistan','🇵🇰'],['俄罗斯','RU','RUS','Russia','🇷🇺'],
 ['泰国','TH','THA','Thailand','🇹🇭'],['印度','IN','IND','India','🇮🇳'],
 ['阿根廷','AR','ARG','Argentina','🇦🇷'],['芬兰','FI','FIN','Finland','🇫🇮'],
 ['埃及','EG','EGY','Egypt','🇪🇬'],['菲律宾','PH','PHL','Philippines','🇵🇭']
];
const patterns = regions.map(([name, code, iso, english, flag]) => ({name, pattern:
 `${name}|${english}|${flag}|(?:^|[^A-Za-z])(?:${code}|${iso})(?=$|[^A-Za-z])|mitce${code}(?=$|[^A-Za-z])`}));
const extension = `
// 定制覆写：保留原脚本国家识别和基础配置，业务组仅保留 Telegram、AI服务。
// SubStore 通过 $arguments 传入 URL # 参数；自建标签默认匹配节点名称中的“自建”。
const originalMain = main;
function customMain(config) {
    const result = originalMain(config);
    const args = typeof $arguments === 'undefined' ? {} : $arguments;
    const pattern = args.selftag === undefined ? '自建' : String(args.selftag);
    if (!pattern.trim()) throw new Error('selftag 不能为空');
    const matcher = new RegExp(pattern, 'i');
    const selfNodes = config.proxies.filter(p => matcher.test(p.name)).map(p => p.name);
    // 直接使用原始名称：支持 mitceHK、US-1TCP、UKR01 等命名。
    // 默认一个节点也生成地区组；threshold 可显式提高显示门槛。
    const regions = ${JSON.stringify(patterns)};
    const threshold = args.threshold === undefined ? 1 : Number(args.threshold);
    if (!Number.isFinite(threshold) || threshold < 0) throw new Error('threshold 必须是非负数字');
    const groupType = args.grouptype === undefined ? (String(args.loadbalance) === 'true' ? 2 : 1) : Number(args.grouptype);
    if (![0,1,2].includes(groupType)) throw new Error('grouptype 必须是 0、1 或 2');
    const oldRegions = result['proxy-groups'].filter(g => g.name.endsWith('节点') && !['落地节点','低倍率节点'].includes(g.name));
    const buckets = new Map(regions.map(r => [r.name, []]));
    for (const p of config.proxies) {
        // 优先原脚本枚举结果，补充原脚本未识别的代码格式及地区。
        const old = oldRegions.find(g => g.proxies && g.proxies.includes(p.name));
        const region = old ? old.name.slice(0,-2) : regions.find(r => new RegExp(r.pattern,'i').test(p.name))?.name;
        if (region && buckets.has(region)) buckets.get(region).push(p.name);
    }
    const newRegions = regions.filter(r => buckets.get(r.name).length && buckets.get(r.name).length >= threshold).map(r => ({
        name: r.name + '节点', type: ['select','url-test','load-balance'][groupType],
        proxies: buckets.get(r.name),
        ...(groupType ? {url:'https://cp.cloudflare.com/generate_204',interval:60,tolerance:20} : {}),
        ...(groupType === 2 ? {strategy:'sticky-sessions'} : {})
    }));
    const oldNames = new Set(oldRegions.map(g => g.name));
    result['proxy-groups'] = result['proxy-groups'].filter(g => !oldNames.has(g.name));
    for (const g of result['proxy-groups']) if (g.proxies) g.proxies = g.proxies.filter(n => !oldNames.has(n));
    result['proxy-groups'].push(...newRegions);
    for (const g of result['proxy-groups']) if (['选择代理','Telegram','AI服务','GLOBAL','自动选择','故障转移'].includes(g.name)) {
        g.proxies = [...new Set([...(g.proxies || []), ...newRegions.map(r => r.name)])];
    }
    const keep = new Set(['选择代理', '手动选择', '自动选择', '故障转移', '前置代理', '落地节点', 'Final', 'GLOBAL', 'Telegram', 'AI服务']);
    const removed = new Set(result['proxy-groups'].filter(g => !keep.has(g.name) && !g.name.endsWith('节点')).map(g => g.name));
    // 低倍率、Tailscale 属于额外用途组，定制版本不保留。
    removed.add('低倍率节点');
    removed.add('Tailscale');
    result['proxy-groups'] = result['proxy-groups'].filter(g => !removed.has(g.name));
    if (config.proxies.some(p => p.name === '自建') || result['proxy-groups'].some(g => g.name === '自建')) {
        throw new Error('节点或策略组名称“自建”冲突，请重命名节点');
    }
    result['proxy-groups'].push({name: '自建', type: 'select', proxies: selfNodes.length ? selfNodes : ['DIRECT']});
    const reserved = new Set(result['proxy-groups'].map(g => g.name));
    if (new Set(config.proxies.map(p => p.name)).size !== config.proxies.length) throw new Error('存在重复节点名称');
    if (config.proxies.some(p => reserved.has(p.name))) throw new Error('节点名称与策略组名称冲突');
    for (const group of result['proxy-groups']) {
        if (group.proxies) group.proxies = group.proxies.filter(name => !removed.has(name));
        if (['选择代理', 'Telegram', 'AI服务', 'GLOBAL'].includes(group.name)) {
            group.proxies = [...new Set([...(group.proxies || []), '自建'])];
        }
        if (group.proxies && !group.proxies.length) group.proxies = ['DIRECT'];
    }
    // 只替换规则的目标字段，保留 no-resolve、规则顺序及原有直连规则。
    result.rules = result.rules.map(rule => {
        const parts = rule.split(',');
        const index = parts[parts.length - 1] === 'no-resolve' ? parts.length - 2 : parts.length - 1;
        if (removed.has(parts[index])) parts[index] = parts[index] === '广告拦截' ? 'REJECT' : '选择代理';
        return parts.join(',');
    });
    return result;
}
main = customMain;
if (typeof globalThis !== 'undefined') globalThis.main = customMain;
`;
fs.writeFileSync('convert-custom.js', upstream + '\n' + extension);
console.log('Created convert-custom.js');
