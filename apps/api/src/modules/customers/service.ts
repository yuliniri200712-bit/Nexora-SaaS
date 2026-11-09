import { Prisma } from '@prisma/client';
import type { AddressInput, CustomerDetailDto, CustomerDto, CustomerInput } from '@nexora/shared';
import type { TenantContext } from '../../core/context.js';
import { assert } from '../../core/errors.js';
import { db, transaction } from '../../infrastructure/database.js';
import { audit } from '../../infrastructure/audit.js';

const PAGE_SIZE = 20;
const summaryInclude = { _count: { select: { orders: true } } } as const;
type CustomerRecord = Prisma.CustomerGetPayload<{ include: typeof summaryInclude }>;
const dto = (c: CustomerRecord): CustomerDto => ({
  id: c.id,
  name: c.name,
  phone: c.phone,
  email: c.email,
  notes: c.notes,
  version: c.version,
  createdAt: c.createdAt.toISOString(),
  orderCount: c._count.orders,
});
export async function list(context: TenantContext, search: string, page: number) {
  const where: Prisma.CustomerWhereInput = {
    tenantId: context.tenantId,
    ...(search ? { OR: [{ name: { contains: search } }, { phone: { contains: search } }] } : {}),
  };
  const [items, total] = await db.$transaction([
    db.customer.findMany({
      where,
      include: summaryInclude,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.customer.count({ where }),
  ]);
  return { items: items.map(dto), total, page, pageSize: PAGE_SIZE };
}
export async function get(context: TenantContext, id: string): Promise<CustomerDetailDto> {
  const customer = await db.customer.findFirst({
    where: { id, tenantId: context.tenantId },
    include: { ...summaryInclude, addresses: { orderBy: { createdAt: 'asc' } } },
  });
  assert(customer, 404, 'NOT_FOUND', 'Cliente no disponible.');
  const completed = await db.salesOrder.aggregate({
    where: { tenantId: context.tenantId, customerId: id, status: 'COMPLETED' },
    _count: true,
    _sum: { total: true },
  });
  return {
    ...dto(customer),
    addresses: customer.addresses.map((a) => ({
      id: a.id,
      label: a.label,
      line: a.line,
      city: a.city,
      notes: a.notes,
    })),
    completedOrders: completed._count,
    totalSpent: (completed._sum.total ?? new Prisma.Decimal(0)).toFixed(2),
  };
}
export async function create(context: TenantContext, input: CustomerInput) {
  const id = await transaction(async (tx) => {
    const customer = await tx.customer.create({ data: { ...input, tenantId: context.tenantId } });
    await audit(tx, context, 'customer.created', customer.id);
    return customer.id;
  });
  return get(context, id);
}
export async function update(
  context: TenantContext,
  id: string,
  version: number,
  input: CustomerInput,
) {
  await transaction(async (tx) => {
    assert(
      await tx.customer.findFirst({ where: { id, tenantId: context.tenantId } }),
      404,
      'NOT_FOUND',
      'Cliente no disponible.',
    );
    const changed = await tx.customer.updateMany({
      where: { id, tenantId: context.tenantId, version },
      data: { ...input, version: { increment: 1 } },
    });
    assert(
      changed.count === 1,
      409,
      'STALE_VERSION',
      'Otro usuario modificó el cliente. Actualiza e intenta de nuevo.',
    );
    await audit(tx, context, 'customer.updated', id);
  });
  return get(context, id);
}
export async function addAddress(context: TenantContext, customerId: string, input: AddressInput) {
  await transaction(async (tx) => {
    assert(
      await tx.customer.findFirst({ where: { id: customerId, tenantId: context.tenantId } }),
      404,
      'NOT_FOUND',
      'Cliente no disponible.',
    );
    const address = await tx.customerAddress.create({
      data: { ...input, tenantId: context.tenantId, customerId },
    });
    await audit(tx, context, 'customer.address.added', address.id);
  });
  return get(context, customerId);
}
export async function removeAddress(context: TenantContext, customerId: string, addressId: string) {
  await transaction(async (tx) => {
    const removed = await tx.customerAddress.deleteMany({
      where: { id: addressId, customerId, tenantId: context.tenantId },
    });
    assert(removed.count === 1, 404, 'NOT_FOUND', 'Dirección no disponible.');
    await audit(tx, context, 'customer.address.removed', addressId);
  });
  return get(context, customerId);
}
