import { config } from 'dotenv';
config({ quiet: true });
const url = new URL(process.env.TEST_DATABASE_URL ?? '');
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/nexora_test')
  throw new Error('Solo se permite la base local nexora_test.');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.MAIL_TRANSPORT = 'file';
