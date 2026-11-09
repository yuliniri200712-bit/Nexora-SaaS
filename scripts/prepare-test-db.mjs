import { config } from 'dotenv';
import { spawnSync } from 'node:child_process';
config({ quiet: true });
const url = new URL(process.env.TEST_DATABASE_URL ?? '');
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/nexora_test')
  throw new Error('Las pruebas solo pueden migrar nexora_test en localhost.');
const result = spawnSync(
  process.execPath,
  [
    'node_modules/prisma/build/index.js',
    'migrate',
    'deploy',
    '--config',
    'apps/api/prisma.config.ts',
  ],
  { env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL }, stdio: 'inherit' },
);
process.exitCode = result.status ?? 1;
