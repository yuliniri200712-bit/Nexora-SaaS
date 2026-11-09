import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import nodemailer from 'nodemailer';
import { config, dataPath } from '../core/config.js';
export async function sendLink(to: string, subject: string, link: string) {
  const text = `${subject}\n\nAbre este enlace de NEXORA:\n${link}\n\nSi no lo solicitaste, ignora este mensaje.`;
  if (config.MAIL_TRANSPORT === 'file') {
    const dir = resolve(dataPath, 'mailbox');
    await mkdir(dir, { recursive: true });
    await writeFile(
      resolve(dir, `${Date.now()}-${randomUUID()}.json`),
      JSON.stringify({ to, subject, text, createdAt: new Date().toISOString() }),
      { mode: 0o600 },
    );
    return;
  }
  if (!config.SMTP_URL) throw new Error('SMTP no configurado');
  await nodemailer
    .createTransport(config.SMTP_URL)
    .sendMail({ from: config.MAIL_FROM, to, subject, text });
}
