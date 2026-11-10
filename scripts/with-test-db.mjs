// Ejecuta las pruebas de integración en el MySQL temporal y lo elimina al terminar, aunque fallen.
import { spawnSync } from 'node:child_process';

const windows = process.platform === 'win32';
const run = (script) =>
  spawnSync(windows ? 'npm.cmd' : 'npm', ['run', script], { stdio: 'inherit', shell: windows })
    .status ?? 1;

let status = run('test:db:up');
try {
  if (status === 0) status = run('test:integration');
} finally {
  const down = run('test:db:down');
  if (status === 0) status = down;
}
process.exitCode = status;
