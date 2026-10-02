# Mihomo Codex 定制覆写

基于 powerfullz/override-rules 的 MIT 许可脚本，面向 Mihomo 和 SubStore。保留自动地区识别，新增“自建”手动选择组，业务分流策略组仅保留 Telegram 与 AI服务。

## 使用

下载 Release 附件 `convert-custom.js`，在支持 `main(config)` 的客户端中导入 JavaScript 覆写，或在 SubStore 的配置处理脚本中使用其内容。输入必须是 Clash/Mihomo 配置对象，包含 `proxies` 数组；sing-box 的 `outbounds` 需要先通过 SubStore 转换为 Mihomo 格式。

本仓库为私有仓库，Release 下载需要 GitHub 登录，不能把私有下载链接当作匿名 jsDelivr 脚本链接。需要 URL 导入的场景，可将下载文件放在自己可访问的 HTTP 服务上，再将该地址填入 SubStore。不要把 GitHub Token 写入链接。

默认国家组为 `url-test`。SubStore 支持链接片段参数时可使用：

```text
https://你的脚本服务/convert-custom.js#grouptype=1&selftag=自建&threshold=1
```

| 参数 | 默认值 | 作用 |
| --- | --- | --- |
| `grouptype` | `1` | `0` 手动选择，`1` 自动测速，`2` 负载均衡 |
| `selftag` | `自建` | 按节点名称匹配的 JavaScript 正则，匹配结果进入“自建”组 |
| `threshold` | `1` | 地区组显示的最少节点数；一个节点也可显示 |

自建标签示例：`自建-VPS-WS`、`自建-VPS-CFtunnel`、`自建-VPS-直连`。节点同时带地区信息时，也会进入该地区组。无匹配自建节点时，“自建”组显示 `DIRECT`。空标签、无效正则、重复节点名、节点名与组名冲突会明确报错。

## 分组与路由行为

- 地区名称优先使用上游识别结果，补充 `A-mitceHK-1`、`US-1TCP`、`UKR01` 等机场命名。
- 支持香港、台湾、新加坡、日本、韩国、美国、加拿大、英国、德国、法国、澳大利亚、澳门、马来西亚、越南、阿联酋、土耳其、尼日利亚、乌克兰、巴基斯坦、俄罗斯、泰国、印度、阿根廷、芬兰、埃及、菲律宾。
- 保留选择代理、手动选择、自动选择、故障转移、Final、GLOBAL，以及上游在链式代理场景生成的前置代理和落地节点组。
- 业务策略组只保留 Telegram、AI服务。删除其他业务组和低倍率、Tailscale 专用组；它们原有规则目标改为“选择代理”，广告规则目标改为 `REJECT`。原有直连规则保留。
- Telegram、AI服务、选择代理、GLOBAL 均可选择“自建”。
- 国家组每次执行脚本时按名称枚举；订阅刷新时重新生成。`regex` 参数仍可供上游逻辑使用，但定制国家组始终输出明确的节点名单，避免运行时过滤规则与脚本识别不一致。
- 自动测速为 60 秒间隔、20 毫秒容差。测试只能判断测速地址的可达性与延迟，不代表 Telegram 或 AI服务账号可用。

本脚本保留上游 DNS、嗅探、TUN、规则集、Geo 数据等覆写行为，返回新的配置对象。需要其他配置字段时，先核对上游输出行为。它不是只追加策略组的补丁。`full`、`ipv6`、`fakeip`、`tun`、`quic` 等上游参数仍可使用。

## 本地构建与检验

无需 npm 依赖，使用 Node.js 18 或更高版本：

```powershell
node tools/build-custom.cjs
node tools/test-custom.cjs
node tools/test-fixture.cjs
node tools/verify-artifact.cjs convert-custom.js C:\路径\mihomo.exe
```

`tests/node-names.json` 仅保留 113 个测试节点名称，不包含服务器、UUID、密码或订阅地址。测试生成的节点全部指向本地模拟地址，不能作为实际连接配置。

测试覆盖三种组类型、参数边界、空订阅、名称冲突、组引用、组循环及国家识别。Mihomo 检验使用 `-t` 检查生成配置，涵盖三种组类型和两种 `regex` 值。发布后重新下载 Release 附件，校验 SHA-256，并对下载文件重复这些测试。

## 来源

上游：<https://github.com/powerfullz/override-rules>。下载来源和 SHA-256 记录在 `UPSTREAM.json`，原始脚本保存在 `tools/override-reference.js`，定制构建逻辑在 `tools/build-custom.cjs`。许可证见 `LICENSE`。
