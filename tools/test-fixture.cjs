const cp = require('child_process');
const r = cp.spawnSync(process.execPath, ['tools/test-sec.cjs'], {stdio:'inherit',env:{...process.env,NODE_FIXTURE:'tests/node-names.json'}});
process.exit(r.status ?? 1);
