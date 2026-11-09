import { Prisma } from '@prisma/client';
import type { OrderStatus, SalesDayDto, SalesReportDto, TopProductDto } from '@nexora/shared';
import type { TenantContext } from '../../core/context.js';
import { db } from '../../infrastructure/database.js';
import { movementInclude } from '../inventory/service.js';
import { assert } from '../../core/errors.js';
export function dateRange(from: string, to: string) {
  const start = new Date(`${from}T00:00:00-05:00`),
    end = new Date(`${to}T00:00:00-05:00`);
  assert(
    Number.isFinite(start.getTime()) &&
      Number.isFinite(end.getTime()) &&
      end >= start &&
      end.getTime() - start.getTime() <= 366 * 86400000,
    422,
    'INVALID_RANGE',
    'Selecciona un rango de hasta un año.',
  );
  end.setTime(end.getTime() + 86400000);
  return { start, end };
}
export function csvCell(value: unknown) {
  let s = String(value ?? '');
  if (/^[\s]*[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}
export async function dashboard(context: TenantContext, from: Date, to: Date) {
  const tenant = context.tenantId;
  const [products, variants, sums, low, categories, recent, alerts, daily] = await Promise.all([
    db.product.count({ where: { tenantId: tenant, active: true } }),
    db.productVariant.count({ where: { tenantId: tenant, product: { active: true } } }),
    db.inventoryBalance.aggregate({
      where: { tenantId: tenant, variant: { product: { active: true } } },
      _sum: { onHand: true },
    }),
    db.$queryRaw<
      { total: bigint }[]
    >`SELECT COUNT(*) AS total FROM InventoryBalance b JOIN ProductVariant v ON v.id=b.variantId AND v.tenantId=b.tenantId JOIN Product p ON p.id=v.productId AND p.tenantId=v.tenantId WHERE b.tenantId=${tenant} AND p.active=1 AND b.onHand-b.reserved <= v.lowStockThreshold`,
    db.$queryRaw<
      { name: string; units: PrismaDecimal }[]
    >`SELECT COALESCE(c.name,'Sin categoría') AS name, COALESCE(SUM(b.onHand),0) AS units FROM Product p JOIN ProductVariant v ON v.productId=p.id AND v.tenantId=p.tenantId JOIN InventoryBalance b ON b.variantId=v.id AND b.tenantId=v.tenantId LEFT JOIN Category c ON c.id=p.categoryId AND c.tenantId=p.tenantId WHERE p.tenantId=${tenant} AND p.active=1 GROUP BY c.id,c.name ORDER BY units DESC`,
    db.stockMovement.findMany({
      where: { tenantId: tenant, createdAt: { gte: from, lt: to } },
      include: movementInclude,
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    db.$queryRaw<
      {
        id: string;
        sku: string;
        name: string;
        productName: string;
        onHand: number;
        lowStockThreshold: number;
      }[]
    >`SELECT v.id,v.sku,v.name,p.name AS productName,b.onHand,v.lowStockThreshold FROM InventoryBalance b JOIN ProductVariant v ON v.id=b.variantId AND v.tenantId=b.tenantId JOIN Product p ON p.id=v.productId AND p.tenantId=v.tenantId WHERE b.tenantId=${tenant} AND p.active=1 AND b.onHand-b.reserved <= v.lowStockThreshold ORDER BY b.onHand ASC,v.sku ASC LIMIT 8`,
    db.$queryRaw<
      { date: string; incoming: PrismaDecimal; outgoing: PrismaDecimal }[]
    >`SELECT DATE_FORMAT(CONVERT_TZ(createdAt,'+00:00','-05:00'),'%Y-%m-%d') AS date, SUM(CASE WHEN quantity>0 THEN quantity ELSE 0 END) AS incoming, SUM(CASE WHEN quantity<0 THEN -quantity ELSE 0 END) AS outgoing FROM StockMovement WHERE tenantId=${tenant} AND createdAt>=${from} AND createdAt<${to} GROUP BY date ORDER BY date`,
  ]);
  const sales = await salesSnapshot(context, from, to);
  return {
    sales,
    products,
    variants,
    units: sums._sum.onHand ?? 0,
    lowStock: Number(low[0]?.total ?? 0),
    categories: categories.map((c) => ({ ...c, units: Number(c.units) })),
    recent,
    alerts,
    daily: daily.map((d) => ({ ...d, incoming: Number(d.incoming), outgoing: Number(d.outgoing) })),
  };
}
type PrismaDecimal = { toString(): string };
const moneyOf = (value: PrismaDecimal | null | undefined) =>
  new Prisma.Decimal(value?.toString() ?? '0').toFixed(2);
const colombiaDate = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
const completedIn = (tenantId: string, from: Date, to: Date) =>
  ({
    tenantId,
    status: 'COMPLETED',
    completedAt: { gte: from, lt: to },
  }) satisfies Prisma.SalesOrderWhereInput;
async function salesByDay(tenant: string, from: Date, to: Date): Promise<SalesDayDto[]> {
  const rows = await db.$queryRaw<
    { date: string; total: PrismaDecimal; count: bigint }[]
  >`SELECT DATE_FORMAT(CONVERT_TZ(completedAt,'+00:00','-05:00'),'%Y-%m-%d') AS date, SUM(total) AS total, COUNT(*) AS count FROM SalesOrder WHERE tenantId=${tenant} AND status='COMPLETED' AND completedAt>=${from} AND completedAt<${to} GROUP BY date ORDER BY date`;
  return rows.map((r) => ({ date: r.date, total: moneyOf(r.total), count: Number(r.count) }));
}
async function topProducts(
  tenant: string,
  from: Date,
  to: Date,
  limit: number,
): Promise<TopProductDto[]> {
  const rows = await db.$queryRaw<
    {
      sku: string;
      productName: string;
      variantName: string;
      units: PrismaDecimal;
      revenue: PrismaDecimal;
    }[]
  >`SELECT l.sku, l.productName, l.variantName, SUM(l.quantity) AS units, SUM(l.lineTotal) AS revenue FROM OrderLine l JOIN SalesOrder o ON o.id=l.orderId AND o.tenantId=l.tenantId WHERE l.tenantId=${tenant} AND o.status='COMPLETED' AND o.completedAt>=${from} AND o.completedAt<${to} GROUP BY l.sku, l.productName, l.variantName ORDER BY units DESC, revenue DESC, l.sku ASC LIMIT ${limit}`;
  return rows.map((r) => ({
    sku: r.sku,
    productName: r.productName,
    variantName: r.variantName,
    units: Number(r.units),
    revenue: moneyOf(r.revenue),
  }));
}
async function salesSnapshot(context: TenantContext, from: Date, to: Date) {
  const tenant = context.tenantId,
    day = colombiaDate(),
    todayRange = dateRange(day, day),
    monthRange = dateRange(`${day.slice(0, 7)}-01`, day);
  const [today, month, pendingOrders, daily, top] = await Promise.all([
    db.salesOrder.aggregate({
      where: completedIn(tenant, todayRange.start, todayRange.end),
      _count: true,
      _sum: { total: true },
    }),
    db.salesOrder.aggregate({
      where: completedIn(tenant, monthRange.start, monthRange.end),
      _sum: { total: true },
    }),
    db.salesOrder.count({ where: { tenantId: tenant, status: 'CONFIRMED' } }),
    salesByDay(tenant, from, to),
    topProducts(tenant, from, to, 5),
  ]);
  return {
    todayTotal: moneyOf(today._sum.total),
    todayCount: today._count,
    monthTotal: moneyOf(month._sum.total),
    pendingOrders,
    daily,
    topProducts: top,
  };
}
export async function salesReport(
  context: TenantContext,
  from: Date,
  to: Date,
): Promise<SalesReportDto> {
  const tenant = context.tenantId;
  const [summary, units, daily, top, byStatus] = await Promise.all([
    db.salesOrder.aggregate({
      where: completedIn(tenant, from, to),
      _count: true,
      _sum: { total: true, discountTotal: true, deliveryFee: true },
    }),
    db.orderLine.aggregate({
      where: { tenantId: tenant, order: completedIn(tenant, from, to) },
      _sum: { quantity: true },
    }),
    salesByDay(tenant, from, to),
    topProducts(tenant, from, to, 10),
    db.salesOrder.groupBy({
      by: ['status'],
      where: { tenantId: tenant, createdAt: { gte: from, lt: to } },
      _count: true,
    }),
  ]);
  const revenue = new Prisma.Decimal(summary._sum.total?.toString() ?? '0');
  return {
    count: summary._count,
    revenue: revenue.toFixed(2),
    discounts: moneyOf(summary._sum.discountTotal),
    deliveryFees: moneyOf(summary._sum.deliveryFee),
    units: units._sum.quantity ?? 0,
    averageTicket: summary._count
      ? revenue
          .dividedBy(summary._count)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
          .toFixed(2)
      : '0.00',
    daily,
    topProducts: top,
    byStatus: byStatus.map((row) => ({ status: row.status as OrderStatus, count: row._count })),
  };
}
export async function exportSales(context: TenantContext, from: Date, to: Date) {
  const rows = await db.salesOrder.findMany({
    where: completedIn(context.tenantId, from, to),
    include: { createdBy: { select: { user: { select: { name: true } } } } },
    take: 10001,
    orderBy: { completedAt: 'desc' },
  });
  assert(rows.length <= 10000, 422, 'EXPORT_LIMIT', 'Reduce el periodo: máximo 10.000 ventas.');
  return (
    '﻿' +
    [
      [
        'Número',
        'Fecha UTC',
        'Canal',
        'Cliente',
        'Subtotal COP',
        'Descuentos COP',
        'Domicilio COP',
        'Total COP',
        'Responsable',
      ],
      ...rows.map((r) => [
        r.number,
        r.completedAt?.toISOString() ?? '',
        r.channel,
        r.customerName,
        r.subtotal.toFixed(2),
        r.discountTotal.toFixed(2),
        r.deliveryFee.toFixed(2),
        r.total.toFixed(2),
        r.createdBy.user.name,
      ]),
    ]
      .map((r) => r.map(csvCell).join(','))
      .join('\r\n')
  );
}
export async function exportInventory(context: TenantContext) {
  const rows = await db.productVariant.findMany({
    where: { tenantId: context.tenantId, product: { active: true } },
    include: { product: { include: { category: true } }, balance: true },
    take: 10001,
    orderBy: { sku: 'asc' },
  });
  assert(
    rows.length <= 10000,
    422,
    'EXPORT_LIMIT',
    'La exportación admite hasta 10.000 variantes.',
  );
  return (
    '\uFEFF' +
    [
      [
        'Producto',
        'Variante',
        'SKU',
        'Categoría',
        'Precio COP',
        'Existencias',
        'Reservadas',
        'Disponible',
        'Umbral',
      ],
      ...rows.map((r) => [
        r.product.name,
        r.name,
        r.sku,
        r.product.category?.name ?? '',
        r.price.toFixed(2),
        r.balance?.onHand ?? 0,
        r.balance?.reserved ?? 0,
        (r.balance?.onHand ?? 0) - (r.balance?.reserved ?? 0),
        r.lowStockThreshold,
      ]),
    ]
      .map((r) => r.map(csvCell).join(','))
      .join('\r\n')
  );
}
export async function exportMovements(context: TenantContext, from: Date, to: Date) {
  const rows = await db.stockMovement.findMany({
    where: { tenantId: context.tenantId, createdAt: { gte: from, lt: to } },
    include: movementInclude,
    take: 10001,
    orderBy: { createdAt: 'desc' },
  });
  assert(
    rows.length <= 10000,
    422,
    'EXPORT_LIMIT',
    'Reduce el periodo: máximo 10.000 movimientos.',
  );
  return (
    '\uFEFF' +
    [
      [
        'Fecha UTC',
        'SKU',
        'Producto',
        'Tipo',
        'Cambio',
        'Antes',
        'Después',
        'Motivo',
        'Responsable',
      ],
      ...rows.map((r) => [
        r.createdAt.toISOString(),
        r.variant.sku,
        r.variant.product.name,
        r.type,
        r.quantity,
        r.before,
        r.after,
        r.reason,
        r.actor.user.name,
      ]),
    ]
      .map((r) => r.map(csvCell).join(','))
      .join('\r\n')
  );
}
