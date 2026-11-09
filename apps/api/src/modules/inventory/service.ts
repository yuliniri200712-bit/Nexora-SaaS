import type { MovementInput } from '@nexora/shared';
import type { TenantContext } from '../../core/context.js';
import { db, transaction } from '../../infrastructure/database.js';
import { audit } from '../../infrastructure/audit.js';
import { hash } from '../../core/crypto.js';
import { assert } from '../../core/errors.js';
export const movementInclude = {
  variant: { select: { sku: true, name: true, product: { select: { name: true } } } },
  actor: { select: { user: { select: { name: true } } } },
};
export const movementDelta = (input: MovementInput) =>
  input.type === 'OUT' ? -input.quantity : input.quantity;
export async function move(context: TenantContext, input: MovementInput, key: string) {
  const requestHash = hash(JSON.stringify(input));
  return transaction(async (tx) => {
    const prior = await tx.stockMovement.findUnique({
      where: {
        tenantId_actorId_idempotencyKey: {
          tenantId: context.tenantId,
          actorId: context.membershipId,
          idempotencyKey: key,
        },
      },
    });
    if (prior) {
      assert(
        prior.requestHash === requestHash,
        409,
        'IDEMPOTENCY_CONFLICT',
        'La clave ya corresponde a otro movimiento.',
      );
      return prior;
    }
    const variant = await tx.productVariant.findFirst({
      where: { id: input.variantId, tenantId: context.tenantId, product: { active: true } },
      include: { balance: true },
    });
    assert(variant?.balance, 404, 'NOT_FOUND', 'Variante no disponible.');
    const balance = variant.balance,
      delta = movementDelta(input),
      next = balance.onHand + delta;
    assert(
      Number.isSafeInteger(next) && next >= balance.reserved && next <= 2147483647,
      409,
      'INSUFFICIENT_STOCK',
      'El movimiento supera las existencias disponibles o el límite permitido.',
    );
    const changed = await tx.inventoryBalance.updateMany({
      where: {
        id: balance.id,
        tenantId: context.tenantId,
        version: balance.version,
        onHand: balance.onHand,
      },
      data: { onHand: next, version: { increment: 1 } },
    });
    assert(
      changed.count === 1,
      409,
      'STOCK_CONFLICT',
      'Las existencias cambiaron. Actualiza e intenta de nuevo.',
    );
    const movement = await tx.stockMovement.create({
      data: {
        tenantId: context.tenantId,
        variantId: variant.id,
        actorId: context.membershipId,
        type: input.type,
        quantity: delta,
        reason: input.reason,
        before: balance.onHand,
        after: next,
        idempotencyKey: key,
        requestHash,
      },
    });
    await audit(tx, context, 'inventory.moved', movement.id);
    return movement;
  });
}
export async function movements(context: TenantContext, page: number, from?: Date, to?: Date) {
  const where = {
    tenantId: context.tenantId,
    ...(from && to ? { createdAt: { gte: from, lt: to } } : {}),
  };
  const [items, total] = await db.$transaction([
    db.stockMovement.findMany({
      where,
      include: movementInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 25,
      skip: (page - 1) * 25,
    }),
    db.stockMovement.count({ where }),
  ]);
  return { items, total, page, pageSize: 25 };
}
