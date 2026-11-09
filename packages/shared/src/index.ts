import { z } from 'zod';
export { ZodError } from 'zod';

export const roles = ['OWNER', 'ADMIN', 'INVENTORY', 'SELLER', 'COURIER'] as const;
export type Role = (typeof roles)[number];
export const roleLabels: Record<Role, string> = {
  OWNER: 'Propietario',
  ADMIN: 'Administrador',
  INVENTORY: 'Inventario',
  SELLER: 'Vendedor',
  COURIER: 'Repartidor',
};
export const permissions = [
  'catalog:read',
  'catalog:write',
  'inventory:read',
  'inventory:write',
  'reports:read',
  'employees:manage',
  'settings:manage',
  'customers:read',
  'customers:write',
  'orders:read',
  'orders:write',
] as const;
export type Permission = (typeof permissions)[number];
const grants: Record<Role, readonly Permission[]> = {
  OWNER: permissions,
  ADMIN: permissions,
  INVENTORY: [
    'catalog:read',
    'catalog:write',
    'inventory:read',
    'inventory:write',
    'reports:read',
    'orders:read',
  ],
  SELLER: [
    'catalog:read',
    'inventory:read',
    'customers:read',
    'customers:write',
    'orders:read',
    'orders:write',
  ],
  COURIER: [],
};
export const can = (role: Role, permission: Permission) => grants[role].includes(permission);
export const emailSchema = z.email().trim().toLowerCase().max(191);
export const passwordSchema = z.string().min(12, 'Usa al menos 12 caracteres.').max(128);
export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    businessName: z.string().trim().min(2).max(120),
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();
export const loginSchema = z
  .object({ email: emailSchema, password: z.string().min(1).max(128) })
  .strict();
export const categorySchema = z.object({ name: z.string().trim().min(2).max(100) }).strict();
export const moneySchema = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, 'Escribe un valor positivo con máximo dos decimales.');
export const variantSchema = z
  .object({
    id: z.string().uuid().optional(),
    sku: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .transform((v) => v.toUpperCase()),
    name: z.string().trim().min(1).max(100),
    price: moneySchema,
    lowStockThreshold: z.number().int().min(0).max(1000000),
  })
  .strict();
export const productSchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    description: z.string().trim().max(2000),
    categoryId: z.string().uuid().nullable(),
    variants: z.array(variantSchema).min(1).max(30),
  })
  .strict()
  .refine((v) => new Set(v.variants.map((x) => x.sku)).size === v.variants.length, {
    message: 'Cada variante necesita un SKU único.',
    path: ['variants'],
  });
export const movementSchema = z
  .object({
    variantId: z.string().uuid(),
    type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
    quantity: z
      .number()
      .int()
      .min(-1000000)
      .max(1000000)
      .refine((v) => v !== 0, 'La cantidad no puede ser cero.'),
    reason: z.string().trim().min(5).max(500),
  })
  .strict()
  .refine((v) => v.type === 'ADJUSTMENT' || v.quantity > 0, {
    message: 'Entradas y salidas requieren cantidad positiva.',
    path: ['quantity'],
  });
export const invitationSchema = z
  .object({ email: emailSchema, role: z.enum(['ADMIN', 'INVENTORY', 'SELLER', 'COURIER']) })
  .strict();
export const acceptInvitationSchema = z
  .object({
    token: z.string().length(64),
    name: z.string().trim().min(2).max(100),
    password: passwordSchema,
  })
  .strict();
export const employeeSchema = z
  .object({ role: z.enum(['ADMIN', 'INVENTORY', 'SELLER', 'COURIER']), active: z.boolean() })
  .strict();
export const settingsSchema = z.object({ name: z.string().trim().min(2).max(120) }).strict();
const phoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s()-]/g, ''))
  .pipe(z.string().regex(/^\+?\d{7,15}$/, 'Escribe un teléfono válido, solo con números.'));
export const customerSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    phone: phoneSchema.nullable(),
    email: emailSchema.nullable(),
    notes: z.string().trim().max(500),
  })
  .strict();
export const addressSchema = z
  .object({
    label: z.string().trim().min(2).max(50),
    line: z.string().trim().min(5).max(200),
    city: z.string().trim().min(2).max(100),
    notes: z.string().trim().max(300),
  })
  .strict();
export const orderLineSchema = z
  .object({
    variantId: z.string().uuid(),
    quantity: z.number().int().min(1).max(100000),
    discount: moneySchema,
  })
  .strict();
const orderLines = z
  .array(orderLineSchema)
  .min(1, 'Agrega al menos un producto.')
  .max(100)
  .refine((lines) => new Set(lines.map((l) => l.variantId)).size === lines.length, {
    message: 'Cada producto solo puede aparecer una vez.',
  });
export const channels = ['COUNTER', 'DELIVERY'] as const;
export const orderSchema = z
  .object({
    channel: z.enum(channels),
    customerId: z.string().uuid().nullable(),
    addressId: z.string().uuid().nullable(),
    lines: orderLines,
    discount: moneySchema,
    deliveryFee: moneySchema,
    notes: z.string().trim().max(500),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.channel === 'DELIVERY' && (!v.customerId || !v.addressId))
      ctx.addIssue({
        code: 'custom',
        path: ['addressId'],
        message: 'Un domicilio necesita cliente y dirección.',
      });
    if (v.channel === 'COUNTER' && (v.addressId || toCents(v.deliveryFee) !== 0n))
      ctx.addIssue({
        code: 'custom',
        path: ['deliveryFee'],
        message: 'La venta en mostrador no lleva dirección ni domicilio.',
      });
    if (v.addressId && !v.customerId)
      ctx.addIssue({
        code: 'custom',
        path: ['customerId'],
        message: 'La dirección debe pertenecer a un cliente.',
      });
  });
export const saleSchema = z
  .object({
    customerId: z.string().uuid().nullable(),
    lines: orderLines,
    discount: moneySchema,
    notes: z.string().trim().max(500),
  })
  .strict();
export const orderVersionSchema = z.object({ version: z.number().int().nonnegative() }).strict();
export const cancelOrderSchema = z
  .object({
    version: z.number().int().nonnegative(),
    reason: z.string().trim().min(5, 'Indica el motivo de la cancelación.').max(500),
  })
  .strict();
export function toCents(value: string): bigint {
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
}
export function fromCents(cents: bigint): string {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}
export interface TotalsLine {
  variantId: string;
  unitPrice: string;
  quantity: number;
  discount: string;
}
export interface TotalsResult {
  subtotal: string;
  orderDiscount: string;
  discountTotal: string;
  deliveryFee: string;
  total: string;
  lines: { variantId: string; base: string; orderDiscountShare: string; lineTotal: string }[];
}
export class TotalsError extends Error {}
/**
 * Calcula en centavos enteros. El descuento global se reparte en proporción al neto de cada
 * línea; los centavos restantes se asignan por mayor residuo y, en empate, por variantId.
 */
export function calculateTotals(
  lines: TotalsLine[],
  orderDiscount: string,
  deliveryFee: string,
): TotalsResult {
  const rows = [...lines]
    .sort((a, b) => (a.variantId < b.variantId ? -1 : 1))
    .map((line) => {
      const base = toCents(line.unitPrice) * BigInt(line.quantity),
        discount = toCents(line.discount);
      if (discount > base) throw new TotalsError('El descuento supera el valor de la línea.');
      return { variantId: line.variantId, base, discount, net: base - discount };
    });
  const netSum = rows.reduce((sum, row) => sum + row.net, 0n),
    global = toCents(orderDiscount),
    fee = toCents(deliveryFee);
  if (global > netSum) throw new TotalsError('El descuento supera el valor de los productos.');
  const shares = rows.map((row) => {
    const scaled = netSum === 0n ? 0n : global * row.net;
    return {
      share: netSum === 0n ? 0n : scaled / netSum,
      rest: netSum === 0n ? 0n : scaled % netSum,
    };
  });
  let pending = global - shares.reduce((sum, item) => sum + item.share, 0n);
  const order = shares
    .map((item, index) => ({ index, rest: item.rest }))
    .sort((a, b) => (a.rest === b.rest ? a.index - b.index : a.rest > b.rest ? -1 : 1));
  for (const { index } of order) {
    if (pending === 0n) break;
    if (rows[index]!.net > shares[index]!.share) {
      shares[index]!.share += 1n;
      pending -= 1n;
    }
  }
  const subtotal = rows.reduce((sum, row) => sum + row.base, 0n),
    lineDiscounts = rows.reduce((sum, row) => sum + row.discount, 0n),
    discountTotal = lineDiscounts + global;
  return {
    subtotal: fromCents(subtotal),
    orderDiscount: fromCents(global),
    discountTotal: fromCents(discountTotal),
    deliveryFee: fromCents(fee),
    total: fromCents(subtotal - discountTotal + fee),
    lines: rows.map((row, index) => ({
      variantId: row.variantId,
      base: fromCents(row.base),
      orderDiscountShare: fromCents(shares[index]!.share),
      lineTotal: fromCents(row.net - shares[index]!.share),
    })),
  };
}
export type ProductInput = z.infer<typeof productSchema>;
export type MovementInput = z.infer<typeof movementSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
export type SaleInput = z.infer<typeof saleSchema>;
export type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
export type OrderChannel = (typeof channels)[number];
export const orderStatusLabels: Record<OrderStatus, string> = {
  DRAFT: 'Borrador',
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};
export const channelLabels: Record<OrderChannel, string> = {
  COUNTER: 'Mostrador',
  DELIVERY: 'Domicilio',
};
export const movementTypeLabels: Record<string, string> = {
  IN: 'Entrada',
  OUT: 'Salida',
  ADJUSTMENT: 'Ajuste',
  RESERVE: 'Reserva',
  RELEASE: 'Liberación',
  SALE: 'Venta',
};
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  membershipId: string;
  role: Role;
  tenant: { id: string; name: string };
  memberships: { id: string; tenantId: string; name: string; role: Role }[];
}
export interface CategoryDto {
  id: string;
  name: string;
  _count?: { products: number };
}
export interface VariantDto {
  id: string;
  sku: string;
  name: string;
  price: string;
  lowStockThreshold: number;
  balance: { onHand: number; reserved: number; version: number } | null;
}
export interface ProductDto {
  id: string;
  name: string;
  description: string;
  active: boolean;
  version: number;
  category: CategoryDto | null;
  variants: VariantDto[];
  imageId: string | null;
}
export interface MovementDto {
  id: string;
  type: string;
  quantity: number;
  reservedDelta: number;
  reason: string;
  before: number;
  after: number;
  createdAt: string;
  variant: { sku: string; name: string; product: { name: string } };
  actor: { user: { name: string } };
}
export interface EmployeeDto {
  id: string;
  role: Role;
  active: boolean;
  user: { name: string; email: string };
  createdAt: string;
}
export interface InvitationDto {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}
export interface DashboardDto {
  products: number;
  variants: number;
  units: number;
  lowStock: number;
  categories: { name: string; units: number }[];
  recent: MovementDto[];
  alerts: {
    id: string;
    sku: string;
    name: string;
    productName: string;
    onHand: number;
    lowStockThreshold: number;
  }[];
  daily: { date: string; incoming: number; outgoing: number }[];
  sales: {
    todayTotal: string;
    todayCount: number;
    monthTotal: string;
    pendingOrders: number;
    daily: SalesDayDto[];
    topProducts: TopProductDto[];
  };
}
export interface SalesDayDto {
  date: string;
  total: string;
  count: number;
}
export interface TopProductDto {
  sku: string;
  productName: string;
  variantName: string;
  units: number;
  revenue: string;
}
export interface SalesReportDto {
  count: number;
  revenue: string;
  discounts: string;
  deliveryFees: string;
  units: number;
  averageTicket: string;
  daily: SalesDayDto[];
  topProducts: TopProductDto[];
  byStatus: { status: OrderStatus; count: number }[];
}
export interface AddressDto {
  id: string;
  label: string;
  line: string;
  city: string;
  notes: string;
}
export interface CustomerDto {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string;
  version: number;
  createdAt: string;
  orderCount: number;
}
export interface CustomerDetailDto extends CustomerDto {
  addresses: AddressDto[];
  completedOrders: number;
  totalSpent: string;
}
export interface OrderLineDto {
  id: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  unitPrice: string;
  quantity: number;
  discount: string;
  orderDiscountShare: string;
  lineTotal: string;
}
export interface OrderEventDto {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  reason: string;
  createdAt: string;
  actorName: string;
}
export interface OrderSummaryDto {
  id: string;
  number: number;
  status: OrderStatus;
  channel: OrderChannel;
  customerName: string;
  total: string;
  itemCount: number;
  createdAt: string;
  completedAt: string | null;
  createdByName: string;
}
export interface OrderDto extends OrderSummaryDto {
  customerId: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  subtotal: string;
  orderDiscount: string;
  discountTotal: string;
  deliveryFee: string;
  notes: string;
  version: number;
  confirmedAt: string | null;
  cancelledAt: string | null;
  lines: OrderLineDto[];
  events: OrderEventDto[];
}
