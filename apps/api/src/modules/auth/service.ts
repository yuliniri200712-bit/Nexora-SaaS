import { hashPassword as passwordHash, verifyPassword } from '../../core/password.js';
import { db, transaction } from '../../infrastructure/database.js';
import { config } from '../../core/config.js';
import { hash, token } from '../../core/crypto.js';
import { assert } from '../../core/errors.js';
import type { TenantContext } from '../../core/context.js';
import { sendLink } from '../../infrastructure/mail.js';
import { audit } from '../../infrastructure/audit.js';
const dummyHash = passwordHash(token());
export async function createSession(membershipId: string, tenantId: string) {
  const raw = token();
  await db.session.create({
    data: {
      membershipId,
      tenantId,
      tokenHash: hash(raw),
      expiresAt: new Date(Date.now() + config.SESSION_ABSOLUTE_HOURS * 3600000),
    },
  });
  return raw;
}
export async function register(input: {
  name: string;
  businessName: string;
  email: string;
  password: string;
}) {
  const password = await passwordHash(input.password);
  const member = await transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: input.name, email: input.email, passwordHash: password },
    });
    const tenant = await tx.tenant.create({
      data: { name: input.businessName, locations: { create: { name: 'Almacén principal' } } },
    });
    return tx.membership.create({ data: { userId: user.id, tenantId: tenant.id, role: 'OWNER' } });
  });
  return createSession(member.id, member.tenantId);
}
export async function login(input: { email: string; password: string }) {
  const user = await db.user.findUnique({
    where: { email: input.email },
    include: {
      memberships: {
        where: { active: true, tenant: { active: true } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  const valid = await verifyPassword(user?.passwordHash ?? (await dummyHash), input.password);
  assert(
    valid && user?.active && user.memberships[0],
    401,
    'INVALID_CREDENTIALS',
    'Correo o contraseña incorrectos.',
  );
  return createSession(user.memberships[0].id, user.memberships[0].tenantId);
}
export async function sessionUser(context: TenantContext) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: context.userId },
    include: {
      memberships: { where: { active: true, tenant: { active: true } }, include: { tenant: true } },
    },
  });
  const current = user.memberships.find((m) => m.id === context.membershipId);
  assert(current, 401, 'UNAUTHENTICATED', 'Sesión no disponible.');
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    membershipId: current.id,
    role: current.role,
    tenant: { id: current.tenant.id, name: current.tenant.name },
    memberships: user.memberships.map((m) => ({
      id: m.id,
      tenantId: m.tenantId,
      name: m.tenant.name,
      role: m.role,
    })),
  };
}
export async function renew(context: TenantContext) {
  const raw = token();
  const result = await db.session.updateMany({
    where: { id: context.sessionId, tenantId: context.tenantId },
    data: { tokenHash: hash(raw), lastSeenAt: new Date() },
  });
  assert(result.count === 1, 401, 'UNAUTHENTICATED', 'Sesión no disponible.');
  return raw;
}
export async function switchTenant(context: TenantContext, membershipId: string) {
  const member = await db.membership.findFirst({
    where: { id: membershipId, userId: context.userId, active: true, tenant: { active: true } },
  });
  assert(member, 404, 'NOT_FOUND', 'Comercio no disponible.');
  const raw = token();
  await db.session.update({
    where: { id: context.sessionId },
    data: { membershipId: member.id, tenantId: member.tenantId, tokenHash: hash(raw) },
  });
  return raw;
}
export async function forgot(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user?.active) return;
  const raw = token();
  const reset = await db.passwordReset.create({
    data: { userId: user.id, tokenHash: hash(raw), expiresAt: new Date(Date.now() + 30 * 60000) },
  });
  try {
    await sendLink(
      email,
      'Restablece tu contraseña',
      `${config.APP_ORIGIN}/restablecer?token=${raw}`,
    );
  } catch (error) {
    await db.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } });
    throw error;
  }
}
export async function resetPassword(raw: string, password: string) {
  const nextHash = await passwordHash(password);
  await transaction(async (tx) => {
    const reset = await tx.passwordReset.findUnique({ where: { tokenHash: hash(raw) } });
    assert(
      reset && !reset.usedAt && reset.expiresAt > new Date(),
      400,
      'INVALID_TOKEN',
      'El enlace expiró o ya fue utilizado.',
    );
    const claimed = await tx.passwordReset.updateMany({
      where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    assert(claimed.count === 1, 400, 'INVALID_TOKEN', 'El enlace expiró o ya fue utilizado.');
    await tx.user.update({ where: { id: reset.userId }, data: { passwordHash: nextHash } });
    await tx.passwordReset.updateMany({
      where: { userId: reset.userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.session.deleteMany({ where: { membership: { userId: reset.userId } } });
  });
}
export async function logout(context: TenantContext) {
  await transaction(async (tx) => {
    await tx.session.deleteMany({ where: { id: context.sessionId, tenantId: context.tenantId } });
    await audit(tx, context, 'session.logout', context.membershipId);
  });
}
