import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../apps/api/src/core/password.js';

const password = 'Nexora-Test-Only-2026!';
// Hash de una cuenta TEST generado por la librería argon2 de npm, usada antes de este módulo.
const previousLibraryHash =
  '$argon2id$v=19$m=19456,t=2,p=1$Gk0MJP4nLxZCfcXl10qiqQ$8VzcMvf6x5KzmG9wMQu8ZMK58rUHoSKKcNmY5xefvAw';

describe('Contraseñas con Argon2id', () => {
  it('verifica contraseñas guardadas con la librería anterior', async () => {
    expect(await verifyPassword(previousLibraryHash, password)).toBe(true);
    expect(await verifyPassword(previousLibraryHash, `${password}x`)).toBe(false);
  });
  it('genera hashes en formato estándar con sal distinta en cada uno', async () => {
    const first = await hashPassword(password),
      second = await hashPassword(password);
    expect(first).toMatch(
      /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/,
    );
    expect(first).not.toBe(second);
    expect(await verifyPassword(first, password)).toBe(true);
    expect(await verifyPassword(first, 'otra-clave-distinta')).toBe(false);
  });
  it('rechaza hashes alterados o con otro formato sin lanzar errores', async () => {
    expect(await verifyPassword('', password)).toBe(false);
    expect(await verifyPassword('texto-plano', password)).toBe(false);
    expect(await verifyPassword(previousLibraryHash.replace('argon2id', 'argon2i'), password)).toBe(
      false,
    );
    expect(await verifyPassword(`${previousLibraryHash.slice(0, -2)}AA`, password)).toBe(false);
  });
});
