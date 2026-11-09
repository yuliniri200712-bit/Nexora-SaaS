import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { readFileSync } from 'node:fs';
import { config } from '../core/config.js';
const databaseUrl = new URL(config.DATABASE_URL);
const localDevelopment =
  config.NODE_ENV !== 'production' && ['127.0.0.1', 'localhost'].includes(databaseUrl.hostname);
if (!localDevelopment && !config.DATABASE_CA_PATH)
  throw new Error(
    'Las conexiones MySQL remotas o de producción requieren DATABASE_CA_PATH para verificar TLS.',
  );
const adapter = new PrismaMariaDb({
  host: databaseUrl.hostname,
  port: Number(databaseUrl.port || 3306),
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  database: databaseUrl.pathname.slice(1),
  connectionLimit: 10,
  timezone: 'Z',
  allowPublicKeyRetrieval: localDevelopment,
  ...(config.DATABASE_CA_PATH
    ? { ssl: { ca: readFileSync(config.DATABASE_CA_PATH, 'utf8'), rejectUnauthorized: true } }
    : {}),
});
export const db = new PrismaClient({ adapter });
export type Transaction = Prisma.TransactionClient;
export async function transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034' &&
        attempt < 3
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, 25 * (attempt + 1) + Math.random() * 50),
        );
        continue;
      }
      throw error;
    }
  }
}
