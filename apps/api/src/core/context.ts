import type { Request, Response, NextFunction } from 'express';
import type { Role, Permission } from '@nexora/shared';
import { can } from '@nexora/shared';
import { db } from '../infrastructure/database.js';
import { config, sessionCookie } from './config.js';
import { hash } from './crypto.js';
import { AppError } from './errors.js';
export interface TenantContext {
  tenantId: string;
  membershipId: string;
  userId: string;
  role: Role;
  sessionId: string;
  requestId: string;
}
declare module 'express-serve-static-core' {
  interface Request {
    context?: TenantContext;
    requestId: string;
  }
}
export const ctx = (req: Request) => {
  if (!req.context) throw new AppError(401, 'UNAUTHENTICATED', 'Inicia sesión para continuar.');
  return req.context;
};
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const raw: unknown = req.cookies?.[sessionCookie];
  if (typeof raw !== 'string' || raw.length !== 64)
    throw new AppError(401, 'UNAUTHENTICATED', 'Inicia sesión para continuar.');
  const s = await db.session.findUnique({
    where: { tokenHash: hash(raw) },
    include: { membership: { include: { user: true, tenant: true } } },
  });
  const cutoff = Date.now() - config.SESSION_IDLE_MINUTES * 60000;
  if (
    !s ||
    s.expiresAt.getTime() <= Date.now() ||
    s.lastSeenAt.getTime() < cutoff ||
    !s.membership.active ||
    !s.membership.user.active ||
    !s.membership.tenant.active
  )
    throw new AppError(401, 'UNAUTHENTICATED', 'Tu sesión terminó. Vuelve a ingresar.');
  await db.session.updateMany({
    where: { id: s.id, tokenHash: hash(raw) },
    data: { lastSeenAt: new Date() },
  });
  req.context = {
    tenantId: s.tenantId,
    membershipId: s.membershipId,
    userId: s.membership.userId,
    role: s.membership.role,
    sessionId: s.id,
    requestId: req.requestId,
  };
  next();
}
export const authorize =
  (permission: Permission) => (req: Request, _res: Response, next: NextFunction) => {
    if (!can(ctx(req).role, permission))
      throw new AppError(403, 'FORBIDDEN', 'No tienes permiso para esta acción.');
    next();
  };
