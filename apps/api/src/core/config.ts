import { config as dotenv } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';
export const root = resolve(import.meta.dirname, '../../../..');
dotenv({ path: resolve(root, '.env'), quiet: true });
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3001),
  APP_ORIGIN: z.url().default('http://127.0.0.1:5173'),
  DATABASE_URL: z.string().min(1),
  DATABASE_CA_PATH: z.string().optional(),
  SESSION_IDLE_MINUTES: z.coerce.number().positive().default(30),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().positive().default(12),
  MAIL_TRANSPORT: z.enum(['file', 'smtp']).default('file'),
  MAIL_FROM: z.string().default('NEXORA <no-reply@localhost>'),
  SMTP_URL: z.string().optional(),
});
export const config = schema.parse(process.env);
if (
  config.NODE_ENV === 'production' &&
  (!config.APP_ORIGIN.startsWith('https://') ||
    config.MAIL_TRANSPORT !== 'smtp' ||
    !config.SMTP_URL)
)
  throw new Error('Producción requiere HTTPS y correo SMTP configurado.');
export const dataPath = resolve(root, config.NODE_ENV === 'test' ? '.data/test' : '.data');
export const sessionCookie =
  config.NODE_ENV === 'production' ? '__Host-nexora_session' : 'nexora_session';
export const csrfCookie = config.NODE_ENV === 'production' ? '__Host-nexora_csrf' : 'nexora_csrf';
