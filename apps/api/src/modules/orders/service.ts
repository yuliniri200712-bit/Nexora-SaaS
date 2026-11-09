import { Prisma } from '@prisma/client';
import { calculateTotals, TotalsError } from '@nexora/shared';
import type {
  OrderChannel,
  OrderDto,
  OrderInput,
  OrderStatus,
  OrderSummaryDto,
  SaleInput,
} from '@nexora/shared';
import type { TenantContext } from '../../core/context.js';
import { hash } from '../../core/crypto.js';
import { AppError, assert } from '../../core/errors.js';
import { audit } from '../../infrastructure/audit.js';
import { db, transaction } from '../../infrastructure/database.js';
import type { Transaction } from '../../infrastructure/database.js';
import { applyOrderStock } from '../inventory/service.js';

const PAGE_SIZE = 25;
const actorName = { select: { user: { select: { name: true } } } } as const;
const detailInclude = {
  lines: { orderBy: { sku: 'asc' } },
  events: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], include: { actor: actorName } },
  createdBy: actorName,
} satisfies Prisma.SalesOrderInclude;
const summaryInclude = {
  createdBy: actorName,
  _count: { select: { lines: true } },
} satisfies Prisma.SalesOrderInclude;
type DetailRecord = Prisma.SalesOrderGetPayload<{ include: typeof detailInclude }>;
type SummaryRecord = Prisma.SalesOrderGetPayload<{ include: typeof summaryInclude }>;

const iso = (value: Date | null) => value?.toISOString() ?? null;
const summaryFields = (order: SummaryRecord | DetailRecord, itemCount: number) => ({
  id: order.id,
  number: order.number,
  status: order.status,
  channel: order.channel,
  customerName: order.customerName,
  total: order.total.toFixed(2),
  itemCount,
  createdAt: order.createdAt.toISOString(),
  completedAt: iso(order.completedAt),
  createdByName: order.createdBy.user.name,
});
const summaryDto = (order: SummaryRecord): OrderSummaryDto =>
  summaryFields(order, order._count.lines);
const detailDto = (order: DetailRecord): OrderDto => ({
  ...summaryFields(order, order.lines.length),
  customerId: order.customerId,
  customerPhone: order.customerPhone,
  deliveryAddress: order.deliveryAddress,
  subtotal: order.subtotal.toFixed(2),
  orderDiscount: order.orderDiscount.toFixed(2),
  discountTotal: order.discountTotal.toFixed(2),
  deliveryFee: order.deliveryFee.toFixed(2),
  notes: order.notes,
  version: order.version,
  confirmedAt: iso(order.confirmedAt),
  cancelledAt: iso(order.cancelledAt),
  lines: order.lines.map((line) => ({
    id: line.id,
    variantId: line.variantId,
    productName: line.productName,
    variantName: line.variantName,
    sku: line.sku,
    unitPrice: line.unitPrice.toFixed(2),
    quantity: line.quantity,
    discount: line.discount.toFixed(2),
    orderDiscountShare: line.orderDiscountShare.toFixed(2),
    lineTotal: line.lineTotal.toFixed(2),
  })),
  events: order.events.map((event) => ({
    id: event.id,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    reason: event.reason,
    createdAt: event.createdAt.toISOString(),
    actorName: event.actor.user.name,
  })),
});

export interface OrderFilter {
  page: number;
  status?: OrderStatus;
  channel?: OrderChannel;
  customerId?: string;
  search: string;
  from?: Date;
  to?: Date;
}
export async function list(context: TenantContext, filter: OrderFilter) {
  const range = filter.from && filter.to ? { gte: filter.from, lt: filter.to } : undefined;
  const number = /^\d{1,9}$/.test(filter.search) ? Number(filter.search) : undefined;
  const where: Prisma.SalesOrderWhereInput = {
    tenantId: context.tenantId,
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.channel ? { channel: filter.channel } : {}),
    ...(filter.customerId ? { customerId: filter.customerId } : {}),
    ...(range
      ? filter.status === 'COMPLETED'
        ? { completedAt: range }
        : { createdAt: range }
      : {}),
    ...(filter.search
      ? {
          OR: [
            { customerName: { contains: filter.search } },
            ...(number === undefined ? [] : [{ number }]),
          ],
        }
      : {}),
  };
  const [items, total] = await db.$transaction([
    db.salesOrder.findMany({
      where,
      include: summaryInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (filter.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.salesOrder.count({ where }),
  ]);
  return { items: items.map(summaryDto), total, page: filter.page, pageSize: PAGE_SIZE };
}
export async function get(context: TenantContext, id: string) {
  const order = await db.salesOrder.findFirst({
    where: { id, tenantId: context.tenantId },
    include: detailInclude,
  });
  assert(order, 404, 'NOT_FOUND', 'Pedido no disponible.');
  return detailDto(order);
}

function totalsOf(...args: Parameters<typeof calculateTotals>) {
  try {
    return calculateTotals(...args);
  } catch (error) {
    if (error instanceof TotalsError) throw new AppError(422, 'INVALID_TOTALS', error.message);
    throw error;
  }
}
/** Valida referencias dentro del comercio y fija precios y datos del cliente como snapshot. */
async function prepare(tx: Transaction, context: TenantContext, input: OrderInput) {
  const variants = await tx.productVariant.findMany({
    where: { tenantId: context.tenantId, id: { in: input.lines.map((l) => l.variantId) } },
    include: { product: true },
  });
  assert(
    variants.length === input.lines.length && variants.every((v) => v.product.active),
    404,
    'NOT_FOUND',
    'Alguna referencia no está disponible.',
  );
  const bySku = new Map(variants.map((v) => [v.id, v]));
  let customerName = '',
    customerPhone: string | null = null,
    deliveryAddress: string | null = null;
  if (input.customerId) {
    const customer = await tx.customer.findFirst({
      where: { id: input.customerId, tenantId: context.tenantId },
    });
    assert(customer, 404, 'NOT_FOUND', 'Cliente no disponible.');
    customerName = customer.name;
    customerPhone = customer.phone;
  }
  if (input.addressId) {
    const address = await tx.customerAddress.findFirst({
      where: {
        id: input.addressId,
        tenantId: context.tenantId,
        customerId: input.customerId ?? undefined,
      },
    });
    assert(address, 404, 'NOT_FOUND', 'Dirección no disponible.');
    deliveryAddress = `${address.label}: ${address.line}, ${address.city}${address.notes ? ` (${address.notes})` : ''}`;
  }
  const totals = totalsOf(
    input.lines.map((line) => ({
      variantId: line.variantId,
      unitPrice: bySku.get(line.variantId)!.price.toFixed(2),
      quantity: line.quantity,
      discount: line.discount,
    })),
    input.discount,
    input.deliveryFee,
  );
  const inputLines = new Map(input.lines.map((line) => [line.variantId, line]));
  return {
    header: {
      customerId: input.customerId,
      customerName,
      customerPhone,
      deliveryAddress,
      channel: input.channel,
      subtotal: totals.subtotal,
      orderDiscount: totals.orderDiscount,
      discountTotal: totals.discountTotal,
      deliveryFee: totals.deliveryFee,
      total: totals.total,
      notes: input.notes,
    },
    lines: totals.lines.map((line) => {
      const variant = bySku.get(line.variantId)!,
        source = inputLines.get(line.variantId)!;
      return {
        tenantId: context.tenantId,
        variantId: line.variantId,
        productName: variant.product.name,
        variantName: variant.name,
        sku: variant.sku,
        unitPrice: variant.price,
        quantity: source.quantity,
        discount: source.discount,
        orderDiscountShare: line.orderDiscountShare,
        lineTotal: line.lineTotal,
      };
    }),
  };
}
function recordEvent(
  tx: Transaction,
  context: TenantContext,
  orderId: string,
  fromStatus: OrderStatus | null,
  toStatus: OrderStatus,
  reason = '',
) {
  return tx.orderEvent.create({
    data: {
      tenantId: context.tenantId,
      orderId,
      actorId: context.membershipId,
      fromStatus,
      toStatus,
      reason,
    },
  });
}
async function createOrder(
  context: TenantContext,
  input: OrderInput,
  key: string,
  kind: 'draft' | 'sale',
) {
  const requestHash = hash(JSON.stringify({ kind, input }));
  const id = await transaction(async (tx) => {
    // Serializa la numeración y evita interbloqueos entre altas simultáneas del mismo comercio.
    await tx.$queryRaw`SELECT id FROM Tenant WHERE id = ${context.tenantId} FOR UPDATE`;
    const prior = await tx.salesOrder.findUnique({
      where: {
        tenantId_createdById_idempotencyKey: {
          tenantId: context.tenantId,
          createdById: context.membershipId,
          idempotencyKey: key,
        },
      },
    });
    if (prior) {
      assert(
        prior.requestHash === requestHash,
        409,
        'IDEMPOTENCY_CONFLICT',
        'La clave ya corresponde a otra operación.',
      );
      return prior.id;
    }
    const prepared = await prepare(tx, context, input);
    const { lastOrderNumber: number } = await tx.tenant.update({
      where: { id: context.tenantId },
      data: { lastOrderNumber: { increment: 1 } },
      select: { lastOrderNumber: true },
    });
    const status: OrderStatus = kind === 'sale' ? 'COMPLETED' : 'DRAFT',
      now = new Date();
    const order = await tx.salesOrder.create({
      data: {
        ...prepared.header,
        tenantId: context.tenantId,
        number,
        status,
        createdById: context.membershipId,
        idempotencyKey: key,
        requestHash,
        ...(kind === 'sale' ? { confirmedAt: now, completedAt: now } : {}),
      },
    });
    await tx.orderLine.createMany({
      data: prepared.lines.map((line) => ({ ...line, orderId: order.id })),
    });
    if (kind === 'sale') {
      const lines = await tx.orderLine.findMany({
        where: { tenantId: context.tenantId, orderId: order.id },
      });
      await applyOrderStock(tx, context, order, lines, 'sell');
    }
    await recordEvent(tx, context, order.id, null, status);
    await audit(tx, context, kind === 'sale' ? 'sale.registered' : 'order.created', order.id);
    return order.id;
  });
  return get(context, id);
}
export const createDraft = (context: TenantContext, input: OrderInput, key: string) =>
  createOrder(context, input, key, 'draft');
export const registerSale = (context: TenantContext, input: SaleInput, key: string) =>
  createOrder(
    context,
    { ...input, channel: 'COUNTER', addressId: null, deliveryFee: '0' },
    key,
    'sale',
  );
export async function updateDraft(
  context: TenantContext,
  id: string,
  version: number,
  input: OrderInput,
) {
  await transaction(async (tx) => {
    const order = await tx.salesOrder.findFirst({ where: { id, tenantId: context.tenantId } });
    assert(order, 404, 'NOT_FOUND', 'Pedido no disponible.');
    assert(
      order.status === 'DRAFT',
      409,
      'INVALID_TRANSITION',
      'Solo se pueden editar los pedidos en borrador.',
    );
    const prepared = await prepare(tx, context, input);
    const changed = await tx.salesOrder.updateMany({
      where: { id, tenantId: context.tenantId, version, status: 'DRAFT' },
      data: { ...prepared.header, version: { increment: 1 } },
    });
    assert(changed.count === 1, 409, 'STALE_VERSION', 'El pedido cambió. Actualiza la página.');
    await tx.orderLine.deleteMany({ where: { tenantId: context.tenantId, orderId: id } });
    await tx.orderLine.createMany({
      data: prepared.lines.map((line) => ({ ...line, orderId: id })),
    });
    await audit(tx, context, 'order.updated', id);
  });
  return get(context, id);
}

const transitionFields: Record<
  'CONFIRMED' | 'COMPLETED' | 'CANCELLED',
  'confirmedAt' | 'completedAt' | 'cancelledAt'
> = {
  CONFIRMED: 'confirmedAt',
  COMPLETED: 'completedAt',
  CANCELLED: 'cancelledAt',
};
/**
 * Toda transición es atómica: gana quien actualiza la fila con su versión y estado. Repetir una
 * transición ya aplicada devuelve el pedido sin efectos, para que un reintento sea seguro.
 */
async function transition(
  context: TenantContext,
  id: string,
  version: number,
  target: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED',
  allowed: OrderStatus[],
  message: string,
  effects: (
    tx: Transaction,
    order: Prisma.SalesOrderGetPayload<{ include: { lines: true } }>,
  ) => Promise<void>,
  reason = '',
) {
  await transaction(async (tx) => {
    const order = await tx.salesOrder.findFirst({
      where: { id, tenantId: context.tenantId },
      include: { lines: true },
    });
    assert(order, 404, 'NOT_FOUND', 'Pedido no disponible.');
    if (order.status === target) return;
    assert(allowed.includes(order.status), 409, 'INVALID_TRANSITION', message);
    const changed = await tx.salesOrder.updateMany({
      where: { id, tenantId: context.tenantId, version, status: order.status },
      data: {
        status: target,
        version: { increment: 1 },
        [transitionFields[target]]: new Date(),
      },
    });
    assert(changed.count === 1, 409, 'STALE_VERSION', 'El pedido cambió. Actualiza la página.');
    await effects(tx, order);
    await recordEvent(tx, context, id, order.status, target, reason);
    await audit(tx, context, `order.${target.toLowerCase()}`, id);
  });
  return get(context, id);
}
export const confirm = (context: TenantContext, id: string, version: number) =>
  transition(
    context,
    id,
    version,
    'CONFIRMED',
    ['DRAFT'],
    'Solo se pueden confirmar pedidos en borrador.',
    async (tx, order) => {
      const variants = await tx.productVariant.findMany({
        where: { tenantId: context.tenantId, id: { in: order.lines.map((l) => l.variantId) } },
        include: { product: true },
      });
      for (const line of order.lines) {
        const variant = variants.find((v) => v.id === line.variantId);
        assert(
          variant?.product.active,
          409,
          'PRODUCT_UNAVAILABLE',
          `La referencia ${line.sku} ya no está disponible.`,
        );
        assert(
          variant.price.equals(line.unitPrice),
          409,
          'PRICE_CHANGED',
          `El precio de ${line.sku} cambió. Revisa y guarda el borrador de nuevo.`,
        );
      }
      await applyOrderStock(tx, context, order, order.lines, 'reserve');
    },
  );
export const complete = (context: TenantContext, id: string, version: number) =>
  transition(
    context,
    id,
    version,
    'COMPLETED',
    ['CONFIRMED'],
    'Solo se pueden completar pedidos confirmados.',
    (tx, order) => applyOrderStock(tx, context, order, order.lines, 'consume'),
  );
export const cancel = (context: TenantContext, id: string, version: number, reason: string) =>
  transition(
    context,
    id,
    version,
    'CANCELLED',
    ['DRAFT', 'CONFIRMED'],
    'Un pedido completado no se puede cancelar. Registra la devolución como ajuste de inventario.',
    async (tx, order) => {
      if (order.status === 'CONFIRMED')
        await applyOrderStock(tx, context, order, order.lines, 'release');
    },
    reason,
  );
