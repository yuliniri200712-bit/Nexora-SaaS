import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { registerSchema, loginSchema, emailSchema, passwordSchema } from '@nexora/shared';
import { config, sessionCookie, csrfCookie } from '../../core/config.js';
import { authenticate, ctx } from '../../core/context.js';
import { token } from '../../core/crypto.js';
import * as service from './service.js';
export const authRoutes = Router();
const cookieOptions = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};
export const limiter = rateLimit({
  windowMs: 15 * 60000,
  limit: config.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { code: 'RATE_LIMIT', message: 'Demasiados intentos. Espera unos minutos.' },
});
authRoutes.get('/csrf', (_req, res) => {
  const raw = token();
  res.cookie(csrfCookie, raw, cookieOptions);
  res.json({ csrfToken: raw });
});
authRoutes.post('/register', limiter, async (req, res) => {
  const raw = await service.register(registerSchema.parse(req.body));
  res.cookie(sessionCookie, raw, cookieOptions).status(201).json({ ok: true });
});
authRoutes.post('/login', limiter, async (req, res) => {
  const raw = await service.login(loginSchema.parse(req.body));
  res.cookie(sessionCookie, raw, cookieOptions).json({ ok: true });
});
authRoutes.post('/forgot', limiter, async (req, res) => {
  const body = z.object({ email: emailSchema }).strict().parse(req.body);
  await service.forgot(body.email);
  res.json({
    message: 'Si la cuenta existe, recibirás un enlace de recuperación.',
    mailMode: config.MAIL_TRANSPORT === 'file' ? 'local' : 'email',
  });
});
authRoutes.post('/reset', limiter, async (req, res) => {
  const body = z
    .object({ token: z.string().length(64), password: passwordSchema })
    .strict()
    .parse(req.body);
  await service.resetPassword(body.token, body.password);
  res.json({ ok: true });
});
authRoutes.get('/session', authenticate, async (req, res) =>
  res.json({
    user: await service.sessionUser(ctx(req)),
    mailMode: config.MAIL_TRANSPORT === 'file' ? 'local' : 'email',
  }),
);
authRoutes.post('/renew', authenticate, async (req, res) =>
  res.cookie(sessionCookie, await service.renew(ctx(req)), cookieOptions).json({ ok: true }),
);
authRoutes.post('/switch', authenticate, async (req, res) => {
  const body = z.object({ membershipId: z.uuid() }).strict().parse(req.body);
  res
    .cookie(sessionCookie, await service.switchTenant(ctx(req), body.membershipId), cookieOptions)
    .json({ ok: true });
});
authRoutes.post('/logout', authenticate, async (req, res) => {
  await service.logout(ctx(req));
  res.clearCookie(sessionCookie, cookieOptions).json({ ok: true });
});
