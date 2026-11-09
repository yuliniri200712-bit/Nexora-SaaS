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
] as const;
export type Permission = (typeof permissions)[number];
const grants: Record<Role, readonly Permission[]> = {
  OWNER: permissions,
  ADMIN: permissions,
  INVENTORY: ['catalog:read', 'catalog:write', 'inventory:read', 'inventory:write', 'reports:read'],
  SELLER: ['catalog:read', 'inventory:read'],
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
export type ProductInput = z.infer<typeof productSchema>;
export type MovementInput = z.infer<typeof movementSchema>;
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
}
