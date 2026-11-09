import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(argon2);
const COST = { memory: 19456, passes: 2, parallelism: 1 };
const SALT_BYTES = 16,
  HASH_BYTES = 32;
const STORED = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;
const encode = (bytes: Buffer) => bytes.toString('base64').replace(/=+$/, '');

/**
 * Argon2id de Node, en formato PHC estándar. Se usa la implementación integrada porque el
 * complemento nativo de npm está sin firmar y el Control inteligente de aplicaciones lo bloquea.
 */
export async function hashPassword(password: string) {
  const nonce = randomBytes(SALT_BYTES);
  const digest = await derive('argon2id', {
    message: password,
    nonce,
    tagLength: HASH_BYTES,
    ...COST,
  });
  return `$argon2id$v=19$m=${COST.memory},t=${COST.passes},p=${COST.parallelism}$${encode(nonce)}$${encode(digest)}`;
}

export async function verifyPassword(stored: string, password: string) {
  const parts = STORED.exec(stored);
  if (!parts) return false;
  const [, memory, passes, parallelism, salt, expected] = parts;
  const target = Buffer.from(expected!, 'base64');
  const digest = await derive('argon2id', {
    message: password,
    nonce: Buffer.from(salt!, 'base64'),
    tagLength: target.length,
    memory: Number(memory),
    passes: Number(passes),
    parallelism: Number(parallelism),
  });
  return timingSafeEqual(digest, target);
}
