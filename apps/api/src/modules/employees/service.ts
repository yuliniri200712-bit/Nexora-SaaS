import argon2 from 'argon2';
import type { Role } from '@nexora/shared';
import type { TenantContext } from '../../core/context.js';
import { db, transaction } from '../../infrastructure/database.js';
import { audit } from '../../infrastructure/audit.js';
import { hash, token } from '../../core/crypto.js';
import { assert } from '../../core/errors.js';
import { config } from '../../core/config.js';
import { sendLink } from '../../infrastructure/mail.js';
import { passwordHash } from '../auth/service.js';
export async function list(context: TenantContext) {
  return {
    employees: await db.membership.findMany({
      where: { tenantId: context.tenantId },
      select: {
        id: true,
        role: true,
        active: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    invitations: await db.invitation.findMany({
      where: {
        tenantId: context.tenantId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    mailMode: config.MAIL_TRANSPORT === 'file' ? 'local' : 'email',
  };
}
export async function invite(context: TenantContext, email: string, role: Role) {
  const raw = token();
  const invitation = await transaction(async (tx) => {
    assert(
      !(await tx.membership.findFirst({
        where: { tenantId: context.tenantId, user: { email }, active: true },
      })),
      409,
      'ALREADY_MEMBER',
      'Esta persona ya pertenece al equipo.',
    );
    await tx.invitation.updateMany({
      where: { tenantId: context.tenantId, email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const entry = await tx.invitation.create({
      data: {
        tenantId: context.tenantId,
        email,
        role,
        tokenHash: hash(raw),
        expiresAt: new Date(Date.now() + 48 * 3600000),
      },
    });
    await audit(tx, context, 'employee.invited', entry.id);
    return entry;
  });
  try {
    await sendLink(
      email,
      'Te invitaron a un comercio en NEXORA',
      `${config.APP_ORIGIN}/invitacion?token=${raw}`,
    );
  } catch (error) {
    await db.invitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
    throw error;
  }
  return { id: invitation.id, mailMode: config.MAIL_TRANSPORT === 'file' ? 'local' : 'email' };
}
function pendingInvitation<
  T extends {
    acceptedAt: Date | null;
    revokedAt: Date | null;
    expiresAt: Date;
    tenant: { active: boolean };
  },
>(entry: T | null): T {
  assert(
    entry &&
      !entry.acceptedAt &&
      !entry.revokedAt &&
      entry.expiresAt > new Date() &&
      entry.tenant.active,
    400,
    'INVALID_INVITATION',
    'La invitación expiró o ya fue utilizada.',
  );
  return entry;
}
export async function accept(input: { token: string; name: string; password: string }) {
  const lookup = { where: { tokenHash: hash(input.token) }, include: { tenant: true } };
  // Argon2 es costoso: un token inválido no debe llegar a calcularlo.
  pendingInvitation(await db.invitation.findUnique(lookup));
  const nextHash = await passwordHash(input.password);
  return transaction(async (tx) => {
    const entry = pendingInvitation(await tx.invitation.findUnique(lookup));
    let user = await tx.user.findUnique({ where: { email: entry.email } });
    if (user) {
      assert(
        user.active && (await argon2.verify(user.passwordHash, input.password)),
        400,
        'EXISTING_ACCOUNT',
        'Ya tienes una cuenta. Usa tu contraseña actual para aceptar.',
      );
    } else
      user = await tx.user.create({
        data: { email: entry.email, name: input.name, passwordHash: nextHash },
      });
    const prior = await tx.membership.findUnique({
      where: { tenantId_userId: { tenantId: entry.tenantId, userId: user.id } },
    });
    assert(!prior?.active, 409, 'ALREADY_MEMBER', 'Ya perteneces a este comercio.');
    const changed = await tx.invitation.updateMany({
      where: { id: entry.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { acceptedAt: new Date() },
    });
    assert(changed.count === 1, 409, 'INVALID_INVITATION', 'La invitación ya fue utilizada.');
    if (prior)
      await tx.membership.update({
        where: { id: prior.id },
        data: { role: entry.role, active: true },
      });
    else
      await tx.membership.create({
        data: { tenantId: entry.tenantId, userId: user.id, role: entry.role },
      });
    return { ok: true };
  });
}
export async function update(context: TenantContext, id: string, role: Role, active: boolean) {
  await transaction(async (tx) => {
    const member = await tx.membership.findFirst({ where: { id, tenantId: context.tenantId } });
    assert(member, 404, 'NOT_FOUND', 'Empleado no disponible.');
    assert(
      member.role !== 'OWNER' && member.id !== context.membershipId,
      403,
      'PROTECTED_MEMBER',
      'No puedes modificar al propietario ni tu propio acceso desde aquí.',
    );
    await tx.membership.update({
      where: { tenantId_id: { tenantId: context.tenantId, id } },
      data: { role, active },
    });
    await tx.session.deleteMany({ where: { tenantId: context.tenantId, membershipId: id } });
    await audit(tx, context, 'employee.updated', id);
  });
}
export async function revoke(context: TenantContext, id: string) {
  await transaction(async (tx) => {
    const changed = await tx.invitation.updateMany({
      where: { id, tenantId: context.tenantId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    assert(changed.count === 1, 404, 'NOT_FOUND', 'Invitación no disponible.');
    await audit(tx, context, 'invitation.revoked', id);
  });
}
