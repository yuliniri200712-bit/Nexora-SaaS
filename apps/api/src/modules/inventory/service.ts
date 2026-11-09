import type { MovementInput } from '@nexora/shared';
import type { TenantContext } from '../../core/context.js';
import { db, transaction } from '../../infrastructure/database.js';
import type { Transaction } from '../../infrastructure/database.js';
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
export type OrderStockKind = 'reserve' | 'release' | 'consume' | 'sell';
const orderStockEffects: Record<
  OrderStockKind,
  { type: 'RESERVE' | 'RELEASE' | 'SALE'; onHand: number; reserved: number; label: string }
> = {
  reserve: { type: 'RESERVE', onHand: 0, reserved: 1, label: 'Reserva del pedido' },
  release: { type: 'RELEASE', onHand: 0, reserved: -1, label: 'Liberación del pedido' },
  consume: { type: 'SALE', onHand: -1, reserved: -1, label: 'Salida del pedido' },
  sell: { type: 'SALE', onHand: -1, reserved: 0, label: 'Venta directa' },
};
/**
 * Único punto donde un pedido cambia saldos. Recorre las líneas en orden estable de variante
 * para reducir bloqueos cruzados; debe ejecutarse dentro de la transacción del pedido.
 */
export async function applyOrderStock(
  tx: Transaction,
  context: TenantContext,
  order: { id: string; number: number },
  lines: { id: string; variantId: string; quantity: number; sku: string }[],
  kind: OrderStockKind,
) {
  const effect = orderStockEffects[kind];
  for (const line of [...lines].sort((a, b) => (a.variantId < b.variantId ? -1 : 1))) {
    const balance = await tx.inventoryBalance.findUnique({
      where: { tenantId_variantId: { tenantId: context.tenantId, variantId: line.variantId } },
    });
    assert(balance, 404, 'NOT_FOUND', `La referencia ${line.sku} no está disponible.`);
    const onHand = balance.onHand + effect.onHand * line.quantity,
      reserved = balance.reserved + effect.reserved * line.quantity;
    assert(
      onHand >= 0 && reserved >= 0 && reserved <= onHand,
      409,
      'INSUFFICIENT_STOCK',
      `No hay disponibilidad suficiente de ${line.sku}.`,
    );
    const changed = await tx.inventoryBalance.updateMany({
      where: { id: balance.id, tenantId: context.tenantId, version: balance.version },
      data: { onHand, reserved, version: { increment: 1 } },
    });
    assert(
      changed.count === 1,
      409,
      'STOCK_CONFLICT',
      'Las existencias cambiaron. Actualiza e intenta de nuevo.',
    );
    if (kind === 'reserve')
      await tx.stockReservation.create({
        data: {
          tenantId: context.tenantId,
          lineId: line.id,
          variantId: line.variantId,
          quantity: line.quantity,
        },
      });
    if (kind === 'release' || kind === 'consume') {
      const closed = await tx.stockReservation.updateMany({
        where: { tenantId: context.tenantId, lineId: line.id, status: 'ACTIVE' },
        data: { status: kind === 'release' ? 'RELEASED' : 'CONSUMED' },
      });
      assert(closed.count === 1, 409, 'STOCK_CONFLICT', 'La reserva ya no está activa.');
    }
    const key = `order:${order.id}:${line.id}:${kind}`;
    await tx.stockMovement.create({
      data: {
        tenantId: context.tenantId,
        variantId: line.variantId,
        actorId: context.membershipId,
        orderId: order.id,
        type: effect.type,
        quantity: effect.onHand * line.quantity,
        reservedDelta: effect.reserved * line.quantity,
        reason: `${effect.label} #${order.number}`,
        before: balance.onHand,
        after: onHand,
        idempotencyKey: key,
        requestHash: hash(key),
      },
    });
  }
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
