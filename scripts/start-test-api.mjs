import { config } from 'dotenv';
import { spawn } from 'node:child_process';
config({ quiet: true });
const url = new URL(process.env.TEST_DATABASE_URL ?? '');
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/nexora_test')
  throw new Error('Se requiere nexora_test local.');
const child = spawn(process.execPath, ['--import', 'tsx', 'apps/api/src/server.ts'], {
  env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: process.env.TEST_DATABASE_URL },
  stdio: 'inherit',
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => {
  process.exitCode = code ?? 0;
});
