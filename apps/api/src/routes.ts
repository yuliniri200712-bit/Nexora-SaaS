import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  productSchema,
  categorySchema,
  movementSchema,
  invitationSchema,
  acceptInvitationSchema,
  employeeSchema,
  settingsSchema,
  customerSchema,
  addressSchema,
  orderSchema,
  saleSchema,
  orderVersionSchema,
  cancelOrderSchema,
  channels,
} from '@nexora/shared';
import type { Request } from 'express';
import { authenticate, authorize, ctx } from './core/context.js';
import { assert } from './core/errors.js';
import { db, transaction } from './infrastructure/database.js';
import { audit } from './infrastructure/audit.js';
import * as catalog from './modules/catalog/repository.js';
import * as inventory from './modules/inventory/service.js';
import * as reporting from './modules/reporting/service.js';
import * as employees from './modules/employees/service.js';
import * as media from './modules/media/service.js';
import * as customers from './modules/customers/service.js';
import * as orders from './modules/orders/service.js';
import { limiter as credentialLimiter } from './modules/auth/routes.js';
export const apiRoutes = Router();
const id = z.uuid(),
  page = z.coerce.number().int().min(1).max(100000).default(1);
const rangeSchema = z.object({ from: z.iso.date(), to: z.iso.date() });
const idempotencyKey = (req: Request) =>
  z
    .string()
    .min(16)
    .max(100)
    .regex(/^[a-zA-Z0-9-]+$/)
    .parse(req.get('Idempotency-Key'));
const versioned = <T extends z.ZodObject>(schema: T) =>
  z.object({ version: z.number().int().nonnegative(), data: schema });
const customerUpdate = versioned(customerSchema).strict();
const orderUpdate = z
  .object({ version: z.number().int().nonnegative(), order: orderSchema })
  .strict();
apiRoutes.post('/invitations/accept', credentialLimiter, async (req, res) =>
  res.json(await employees.accept(acceptInvitationSchema.parse(req.body))),
);
apiRoutes.use(authenticate);
apiRoutes.get('/products', authorize('catalog:read'), async (req, res) => {
  const q = z
    .object({
      search: z.string().max(100).default(''),
      page,
      categoryId: id.optional(),
      archived: z
        .enum(['true', 'false'])
        .default('false')
        .transform((v) => v === 'true'),
    })
    .parse(req.query);
  res.json(await catalog.list(ctx(req), q));
});
apiRoutes.get('/products/:id', authorize('catalog:read'), async (req, res) =>
  res.json(await catalog.get(ctx(req), id.parse(req.params.id))),
);
apiRoutes.post('/products', authorize('catalog:write'), async (req, res) =>
  res.status(201).json(await catalog.save(ctx(req), productSchema.parse(req.body))),
);
apiRoutes.put('/products/:id', authorize('catalog:write'), async (req, res) => {
  const input = productSchema
    .safeExtend({ version: z.number().int().nonnegative() })
    .parse(req.body);
  const { version, ...body } = input;
  res.json(await catalog.save(ctx(req), body, id.parse(req.params.id), version));
});
apiRoutes.patch('/products/:id/status', authorize('catalog:write'), async (req, res) => {
  const body = z
    .object({ active: z.boolean(), version: z.number().int().nonnegative() })
    .strict()
    .parse(req.body);
  await catalog.setActive(ctx(req), id.parse(req.params.id), body.active, body.version);
  res.json({ ok: true });
});
apiRoutes.get('/categories', authorize('catalog:read'), async (req, res) =>
  res.json(await catalog.categories(ctx(req))),
);
apiRoutes.post('/categories', authorize('catalog:write'), async (req, res) =>
  res.status(201).json(await catalog.saveCategory(ctx(req), categorySchema.parse(req.body).name)),
);
apiRoutes.put('/categories/:id', authorize('catalog:write'), async (req, res) =>
  res.json(
    await catalog.saveCategory(
      ctx(req),
      categorySchema.parse(req.body).name,
      id.parse(req.params.id),
    ),
  ),
);
apiRoutes.delete('/categories/:id', authorize('catalog:write'), async (req, res) => {
  await catalog.deleteCategory(ctx(req), id.parse(req.params.id));
  res.json({ ok: true });
});
apiRoutes.post('/inventory/movements', authorize('inventory:write'), async (req, res) => {
  const key = idempotencyKey(req);
  res.status(201).json(await inventory.move(ctx(req), movementSchema.parse(req.body), key));
});
apiRoutes.get('/customers', authorize('customers:read'), async (req, res) => {
  const q = z.object({ search: z.string().max(100).default(''), page }).parse(req.query);
  res.json(await customers.list(ctx(req), q.search, q.page));
});
apiRoutes.post('/customers', authorize('customers:write'), async (req, res) =>
  res.status(201).json(await customers.create(ctx(req), customerSchema.parse(req.body))),
);
apiRoutes.get('/customers/:id', authorize('customers:read'), async (req, res) =>
  res.json(await customers.get(ctx(req), id.parse(req.params.id))),
);
apiRoutes.put('/customers/:id', authorize('customers:write'), async (req, res) => {
  const body = customerUpdate.parse(req.body);
  res.json(await customers.update(ctx(req), id.parse(req.params.id), body.version, body.data));
});
apiRoutes.post('/customers/:id/addresses', authorize('customers:write'), async (req, res) =>
  res
    .status(201)
    .json(
      await customers.addAddress(ctx(req), id.parse(req.params.id), addressSchema.parse(req.body)),
    ),
);
apiRoutes.delete(
  '/customers/:id/addresses/:addressId',
  authorize('customers:write'),
  async (req, res) =>
    res.json(
      await customers.removeAddress(
        ctx(req),
        id.parse(req.params.id),
        id.parse(req.params.addressId),
      ),
    ),
);
apiRoutes.get('/orders', authorize('orders:read'), async (req, res) => {
  const q = z
    .object({
      page,
      status: z.enum(['DRAFT', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
      channel: z.enum(channels).optional(),
      customerId: id.optional(),
      search: z.string().max(100).default(''),
      from: z.iso.date().optional(),
      to: z.iso.date().optional(),
    })
    .parse(req.query);
  assert(
    Boolean(q.from) === Boolean(q.to),
    422,
    'INVALID_RANGE',
    'Indica inicio y fin del periodo.',
  );
  const range = q.from && q.to ? reporting.dateRange(q.from, q.to) : undefined;
  const { from: _from, to: _to, ...filter } = q;
  res.json(await orders.list(ctx(req), { ...filter, from: range?.start, to: range?.end }));
});
apiRoutes.get('/orders/:id', authorize('orders:read'), async (req, res) =>
  res.json(await orders.get(ctx(req), id.parse(req.params.id))),
);
apiRoutes.post('/orders', authorize('orders:write'), async (req, res) => {
  const key = idempotencyKey(req);
  res.status(201).json(await orders.createDraft(ctx(req), orderSchema.parse(req.body), key));
});
apiRoutes.put('/orders/:id', authorize('orders:write'), async (req, res) => {
  const body = orderUpdate.parse(req.body);
  res.json(await orders.updateDraft(ctx(req), id.parse(req.params.id), body.version, body.order));
});
apiRoutes.post('/orders/:id/confirm', authorize('orders:write'), async (req, res) =>
  res.json(
    await orders.confirm(
      ctx(req),
      id.parse(req.params.id),
      orderVersionSchema.parse(req.body).version,
    ),
  ),
);
apiRoutes.post('/orders/:id/complete', authorize('orders:write'), async (req, res) =>
  res.json(
    await orders.complete(
      ctx(req),
      id.parse(req.params.id),
      orderVersionSchema.parse(req.body).version,
    ),
  ),
);
apiRoutes.post('/orders/:id/cancel', authorize('orders:write'), async (req, res) => {
  const body = cancelOrderSchema.parse(req.body);
  res.json(await orders.cancel(ctx(req), id.parse(req.params.id), body.version, body.reason));
});
apiRoutes.post('/sales', authorize('orders:write'), async (req, res) => {
  const key = idempotencyKey(req);
  res.status(201).json(await orders.registerSale(ctx(req), saleSchema.parse(req.body), key));
});
apiRoutes.get('/reports/sales', authorize('reports:read'), async (req, res) => {
  const q = rangeSchema.parse(req.query),
    range = reporting.dateRange(q.from, q.to);
  res.json(await reporting.salesReport(ctx(req), range.start, range.end));
});
apiRoutes.get('/reports/sales.csv', authorize('reports:read'), async (req, res) => {
  const q = rangeSchema.parse(req.query),
    range = reporting.dateRange(q.from, q.to);
  res
    .type('text/csv')
    .attachment('nexora-ventas.csv')
    .send(await reporting.exportSales(ctx(req), range.start, range.end));
});
apiRoutes.get('/inventory/movements', authorize('inventory:read'), async (req, res) => {
  const q = z
    .object({ page, from: z.iso.date().optional(), to: z.iso.date().optional() })
    .parse(req.query);
  assert(
    Boolean(q.from) === Boolean(q.to),
    422,
    'INVALID_RANGE',
    'Indica inicio y fin del periodo.',
  );
  const range = q.from && q.to ? reporting.dateRange(q.from, q.to) : undefined;
  res.json(await inventory.movements(ctx(req), q.page, range?.start, range?.end));
});
apiRoutes.get('/reports/dashboard', authorize('reports:read'), async (req, res) => {
  const q = rangeSchema.parse(req.query),
    range = reporting.dateRange(q.from, q.to);
  res.json(await reporting.dashboard(ctx(req), range.start, range.end));
});
apiRoutes.get('/reports/inventory.csv', authorize('reports:read'), async (req, res) =>
  res
    .type('text/csv')
    .attachment('nexora-inventario.csv')
    .send(await reporting.exportInventory(ctx(req))),
);
apiRoutes.get('/reports/movements.csv', authorize('reports:read'), async (req, res) => {
  const q = rangeSchema.parse(req.query),
    range = reporting.dateRange(q.from, q.to);
  res
    .type('text/csv')
    .attachment('nexora-movimientos.csv')
    .send(await reporting.exportMovements(ctx(req), range.start, range.end));
});
apiRoutes.get('/employees', authorize('employees:manage'), async (req, res) =>
  res.json(await employees.list(ctx(req))),
);
apiRoutes.post('/employees/invite', authorize('employees:manage'), async (req, res) => {
  const body = invitationSchema.parse(req.body);
  res.status(201).json(await employees.invite(ctx(req), body.email, body.role));
});
apiRoutes.patch('/employees/:id', authorize('employees:manage'), async (req, res) => {
  const body = employeeSchema.parse(req.body);
  await employees.update(ctx(req), id.parse(req.params.id), body.role, body.active);
  res.json({ ok: true });
});
apiRoutes.delete('/invitations/:id', authorize('employees:manage'), async (req, res) => {
  await employees.revoke(ctx(req), id.parse(req.params.id));
  res.json({ ok: true });
});
const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
});
apiRoutes.post(
  '/products/:id/image',
  authorize('catalog:write'),
  uploader.single('image'),
  async (req, res) => {
    assert(req.file, 422, 'IMAGE_REQUIRED', 'Selecciona una imagen.');
    res.status(201).json(await media.upload(ctx(req), id.parse(req.params.id), req.file.buffer));
  },
);
apiRoutes.get('/images/:id', authorize('catalog:read'), async (req, res) => {
  res
    .set('Cache-Control', 'private, no-store')
    .type('image/webp')
    .sendFile(await media.imagePath(ctx(req), id.parse(req.params.id)), { dotfiles: 'allow' });
});
apiRoutes.get('/settings', authorize('settings:manage'), async (req, res) =>
  res.json(
    await db.tenant.findUnique({
      where: { id: ctx(req).tenantId },
      select: { name: true, timezone: true, currency: true },
    }),
  ),
);
apiRoutes.put('/settings', authorize('settings:manage'), async (req, res) => {
  const body = settingsSchema.parse(req.body),
    context = ctx(req);
  await transaction(async (tx) => {
    await tx.tenant.update({ where: { id: context.tenantId }, data: body });
    await audit(tx, context, 'tenant.updated', context.tenantId);
  });
  res.json({ ok: true });
});
