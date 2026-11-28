import { spawnSync } from 'node:child_process';
// This command does not enable the Neon endpoint or deploy anything.
const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['exec','--','vite','--host','localhost','--port','5173','--strictPort','--open','/sql13-local.html'], {stdio:'inherit',shell:process.platform==='win32'});
if(result.error) { console.error(result.error.message); process.exit(1); }
process.exit(result.status ?? 1);
