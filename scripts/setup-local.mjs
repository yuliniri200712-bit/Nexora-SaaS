import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (existsSync('.env')) {
  console.log('.env ya existe; se conserva.');
} else {
  const password = randomBytes(24).toString('hex');
  writeFileSync(
    '.env',
    `NODE_ENV=development\nPORT=3001\nAPP_ORIGIN=http://127.0.0.1:5173\nDATABASE_URL=mysql://nexora:${password}@127.0.0.1:3307/nexora_principal\nTEST_DATABASE_URL=mysql://nexora:solo-pruebas-temporal@127.0.0.1:3308/nexora_test\nMYSQL_ROOT_PASSWORD=${randomBytes(24).toString('hex')}\nMYSQL_PASSWORD=${password}\nSESSION_IDLE_MINUTES=30\nSESSION_ABSOLUTE_HOURS=12\nMAIL_TRANSPORT=file\nMAIL_FROM=NEXORA <no-reply@localhost>\n`,
    { mode: 0o600 },
  );
  console.log('Configuración local generada. Secretos excluidos de Git.');
}
