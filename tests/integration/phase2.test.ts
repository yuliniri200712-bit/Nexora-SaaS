import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { app } from '../../apps/api/src/app.js';
import { db } from '../../apps/api/src/infrastructure/database.js';
import { config, dataPath } from '../../apps/api/src/core/config.js';

const run = randomUUID().slice(0, 8),
  password = 'Nexora-Test-Only-2026!';
class Client {
  agent = request.agent(app);
  csrf = '';
  async init() {
    this.csrf = (await this.agent.get('/api/v1/auth/csrf')).body.csrfToken;
    return this;
  }
  get(path: string) {
    return this.agent.get(`/api/v1${path}`);
  }
  private write(method: 'post' | 'put' | 'patch' | 'delete', path: string) {
    return this.agent[method](`/api/v1${path}`)
      .set('Origin', config.APP_ORIGIN)
      .set('X-CSRF-Token', this.csrf);
  }
  post(path: string, body: unknown, key?: string) {
    const r = this.write('post', path);
    if (key) r.set('Idempotency-Key', key);
    return r.send(body as object);
  }
  put(path: string, body: unknown) {
    return this.write('put', path).send(body as object);
  }
  patch(path: string, body: unknown) {
    return this.write('patch', path).send(body as object);
  }
  del(path: string) {
    return this.write('delete', path).send();
  }
}
async function owner(label: string) {
  const client = await new Client().init();
  const email = `test-p2-${label}-${run}@example.test`;
  const response = await client.post('/auth/register', {
    name: `TEST ${label}`,
    businessName: `TEST Fase2 ${label} ${run}`,
    email,
    password,
  });
  expect(response.status).toBe(201);
  const user = (await client.get('/auth/session')).body.user;
  return { client, tenantId: user.tenant.id as string, email };
}
async function mailToken(email: string) {
  const dir = resolve(dataPath, 'mailbox');
  for (const name of (await readdir(dir)).sort().reverse()) {
    const body = JSON.parse(await readFile(resolve(dir, name), 'utf8'));
    if (body.to === email) return body.text.match(/token=([a-f0-9]{64})/)[1] as string;
  }
  throw new Error('No se encontró correo de prueba.');
}
let sku = 0;
async function product(client: Client, price: string, stock: number) {
  sku += 1;
  const code = `P2-${run}-${sku}`;
  const created = await client.post('/products', {
    name: `TEST ${code}`,
    description: 'Fixture de integración; no son datos reales.',
    categoryId: null,
    variants: [{ sku: code, name: 'Principal', price, lowStockThreshold: 1 }],
  });
  expect(created.status).toBe(201);
  const variantId = created.body.variants[0].id as string;
  if (stock > 0)
    expect(
      (
        await client.post(
          '/inventory/movements',
          { variantId, type: 'IN', quantity: stock, reason: 'TEST existencias' },
          randomUUID(),
        )
      ).status,
    ).toBe(201);
  return { variantId, productId: created.body.id as string, body: created.body };
}
const balance = (variantId: string) =>
  db.inventoryBalance.findUniqueOrThrow({ where: { variantId } });
const line = (variantId: string, quantity: number, discount = '0') => ({
  variantId,
  quantity,
  discount,
});
const sale = (
  lines: ReturnType<typeof line>[],
  discount = '0',
  customerId: string | null = null,
) => ({
  customerId,
  lines,
  discount,
  notes: '',
});
const draft = (lines: ReturnType<typeof line>[], extra: object = {}) => ({
  channel: 'COUNTER',
  customerId: null,
  addressId: null,
  lines,
  discount: '0',
  deliveryFee: '0',
  notes: '',
  ...extra,
});
async function confirmedOrder(client: Client, variantId: string, quantity: number) {
  const created = await client.post('/orders', draft([line(variantId, quantity)]), randomUUID());
  expect(created.status).toBe(201);
  const confirmed = await client.post(`/orders/${created.body.id}/confirm`, {
    version: created.body.version,
  });
  expect(confirmed.status).toBe(200);
  return confirmed.body;
}

let a: Client, b: Client, tenantA: string;
describe('Fase 2 contra MySQL real', () => {
  beforeAll(async () => {
    const first = await owner('a'),
      second = await owner('b');
    a = first.client;
    b = second.client;
    tenantA = first.tenantId;
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  it('gestiona clientes y direcciones con teléfono único por comercio', async () => {
    const phone = `300${Date.now().toString().slice(-7)}`;
    const body = {
      name: 'TEST Cliente',
      phone: `${phone.slice(0, 3)} ${phone.slice(3)}`,
      email: null,
      notes: '',
    };
    const created = await a.post('/customers', body);
    expect(created.status).toBe(201);
    expect(created.body.phone).toBe(phone);
    expect((await a.post('/customers', body)).status).toBe(409);
    expect((await b.post('/customers', body)).status).toBe(201);
    const updated = await a.put(`/customers/${created.body.id}`, {
      version: created.body.version,
      data: { ...body, name: 'TEST Cliente Editado' },
    });
    expect(updated.status).toBe(200);
    expect(
      (
        await a.put(`/customers/${created.body.id}`, {
          version: created.body.version,
          data: body,
        })
      ).status,
    ).toBe(409);
    const withAddress = await a.post(`/customers/${created.body.id}/addresses`, {
      label: 'Casa',
      line: 'Calle 10 # 20-30',
      city: 'Bogotá',
      notes: '',
    });
    expect(withAddress.status).toBe(201);
    expect(withAddress.body.addresses).toHaveLength(1);
    const removed = await a.del(
      `/customers/${created.body.id}/addresses/${withAddress.body.addresses[0].id}`,
    );
    expect(removed.body.addresses).toHaveLength(0);
  });

  it('calcula totales con descuentos y reparte el descuento global sin perder centavos', async () => {
    const one = await product(a, '100.00', 10),
      two = await product(a, '100.00', 10),
      three = await product(a, '100.00', 10);
    const response = await a.post(
      '/sales',
      sale([line(one.variantId, 1), line(two.variantId, 1), line(three.variantId, 1)], '1.00'),
      randomUUID(),
    );
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      subtotal: '300.00',
      discountTotal: '1.00',
      deliveryFee: '0.00',
      total: '299.00',
      status: 'COMPLETED',
    });
    const shares = response.body.lines.map((l: { orderDiscountShare: string }) =>
      Math.round(Number(l.orderDiscountShare) * 100),
    );
    expect(shares.reduce((sum: number, n: number) => sum + n, 0)).toBe(100);
    expect([...shares].sort()).toEqual([33, 33, 34]);
    const excessive = await a.post(
      '/sales',
      sale([line(one.variantId, 1, '100.01')]),
      randomUUID(),
    );
    expect(excessive.status).toBe(422);
    expect((await balance(one.variantId)).onHand).toBe(9);
  });

  it('la venta directa descuenta stock, deja trazabilidad y no duplica al reintentar', async () => {
    const { variantId } = await product(a, '50000.00', 5);
    const key = randomUUID(),
      body = sale([line(variantId, 2)]);
    const first = await a.post('/sales', body, key),
      second = await a.post('/sales', body, key);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect((await a.post('/sales', sale([line(variantId, 3)]), key)).status).toBe(409);
    expect((await balance(variantId)).onHand).toBe(3);
    const moves = await db.stockMovement.findMany({
      where: { tenantId: tenantA, variantId, type: 'SALE' },
    });
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ quantity: -2, orderId: first.body.id, before: 5, after: 3 });
    expect(first.body.events).toHaveLength(1);
    expect(first.body.events[0].toStatus).toBe('COMPLETED');
  });

  it('no permite vender sin disponibilidad y no deja rastro del intento', async () => {
    const { variantId } = await product(a, '1000.00', 1);
    const before = await db.salesOrder.count({ where: { tenantId: tenantA } });
    const response = await a.post('/sales', sale([line(variantId, 2)]), randomUUID());
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('INSUFFICIENT_STOCK');
    expect((await balance(variantId)).onHand).toBe(1);
    expect(await db.salesOrder.count({ where: { tenantId: tenantA } })).toBe(before);
  });

  it('dos ventas por la última unidad producen un solo consumo', async () => {
    const { variantId } = await product(a, '1000.00', 1);
    const results = await Promise.all([
      a.post('/sales', sale([line(variantId, 1)]), randomUUID()),
      a.post('/sales', sale([line(variantId, 1)]), randomUUID()),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await balance(variantId)).onHand).toBe(0);
    expect(await db.stockMovement.count({ where: { variantId, type: 'SALE' } })).toBe(1);
  });

  it('solicitudes simultáneas con la misma clave crean una sola venta', async () => {
    const { variantId } = await product(a, '1000.00', 20);
    const key = randomUUID(),
      body = sale([line(variantId, 1)]);
    const results = await Promise.all([1, 2, 3].map(() => a.post('/sales', body, key)));
    expect(results.map((r) => r.status)).toEqual([201, 201, 201]);
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
    expect((await balance(variantId)).onHand).toBe(19);
  });

  it('numera los pedidos de cada comercio sin repetir bajo concurrencia', async () => {
    const { variantId } = await product(a, '1000.00', 50);
    const results = await Promise.all(
      Array.from({ length: 6 }, () => a.post('/sales', sale([line(variantId, 1)]), randomUUID())),
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(new Set(results.map((r) => r.body.number)).size).toBe(6);
  });

  it('el borrador no reserva; confirmar reserva y protege lo comprometido', async () => {
    const { variantId } = await product(a, '2000.00', 5);
    const created = await a.post('/orders', draft([line(variantId, 4)]), randomUUID());
    expect(created.body.status).toBe('DRAFT');
    expect((await balance(variantId)).reserved).toBe(0);
    const confirmed = await a.post(`/orders/${created.body.id}/confirm`, {
      version: created.body.version,
    });
    expect(confirmed.body.status).toBe('CONFIRMED');
    expect(await balance(variantId)).toMatchObject({ onHand: 5, reserved: 4 });
    expect((await a.post('/sales', sale([line(variantId, 2)]), randomUUID())).status).toBe(409);
    expect(
      (
        await a.post(
          '/inventory/movements',
          { variantId, type: 'OUT', quantity: 2, reason: 'TEST salida manual' },
          randomUUID(),
        )
      ).status,
    ).toBe(409);
    const other = await a.post('/orders', draft([line(variantId, 2)]), randomUUID());
    expect(
      (await a.post(`/orders/${other.body.id}/confirm`, { version: other.body.version })).status,
    ).toBe(409);
    expect((await a.post('/sales', sale([line(variantId, 1)]), randomUUID())).status).toBe(201);
    expect(await balance(variantId)).toMatchObject({ onHand: 4, reserved: 4 });
  });

  it('completar consume la reserva una sola vez aunque se repita', async () => {
    const { variantId } = await product(a, '2000.00', 5);
    const order = await confirmedOrder(a, variantId, 3);
    const first = await a.post(`/orders/${order.id}/complete`, { version: order.version }),
      retry = await a.post(`/orders/${order.id}/complete`, { version: order.version });
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(retry.body.status).toBe('COMPLETED');
    expect(await balance(variantId)).toMatchObject({ onHand: 2, reserved: 0 });
    expect(await db.stockMovement.count({ where: { orderId: order.id, type: 'SALE' } })).toBe(1);
    expect(await db.stockReservation.findFirstOrThrow({ where: { variantId } })).toMatchObject({
      status: 'CONSUMED',
    });
  });

  it('cancelar libera una sola vez y exige motivo', async () => {
    const { variantId } = await product(a, '2000.00', 5);
    const order = await confirmedOrder(a, variantId, 3);
    expect(
      (await a.post(`/orders/${order.id}/cancel`, { version: order.version, reason: '' })).status,
    ).toBe(422);
    const body = { version: order.version, reason: 'TEST el cliente desistió' };
    expect((await a.post(`/orders/${order.id}/cancel`, body)).status).toBe(200);
    const retry = await a.post(`/orders/${order.id}/cancel`, body);
    expect(retry.status).toBe(200);
    expect(await balance(variantId)).toMatchObject({ onHand: 5, reserved: 0 });
    expect(await db.stockMovement.count({ where: { orderId: order.id, type: 'RELEASE' } })).toBe(1);
    expect(
      (await a.post(`/orders/${order.id}/complete`, { version: retry.body.version })).status,
    ).toBe(409);
    expect(retry.body.events.at(-1)).toMatchObject({
      toStatus: 'CANCELLED',
      reason: 'TEST el cliente desistió',
    });
  });

  it('un pedido completado no se cancela ni repone stock', async () => {
    const { variantId } = await product(a, '2000.00', 5);
    const order = await confirmedOrder(a, variantId, 2);
    const done = await a.post(`/orders/${order.id}/complete`, { version: order.version });
    const cancelled = await a.post(`/orders/${order.id}/cancel`, {
      version: done.body.version,
      reason: 'TEST devolución',
    });
    expect(cancelled.status).toBe(409);
    expect(await balance(variantId)).toMatchObject({ onHand: 3, reserved: 0 });
  });

  it('cancelar contra completar deja un único resultado coherente', async () => {
    for (let round = 0; round < 3; round++) {
      const { variantId } = await product(a, '2000.00', 5);
      const order = await confirmedOrder(a, variantId, 2);
      const results = await Promise.all([
        a.post(`/orders/${order.id}/complete`, { version: order.version }),
        a.post(`/orders/${order.id}/cancel`, { version: order.version, reason: 'TEST carrera' }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      const stored = await db.salesOrder.findUniqueOrThrow({ where: { id: order.id } });
      expect(await balance(variantId)).toMatchObject({
        onHand: stored.status === 'COMPLETED' ? 3 : 5,
        reserved: 0,
      });
    }
  });

  it('confirmar dos veces a la vez reserva una sola vez', async () => {
    const { variantId } = await product(a, '2000.00', 5);
    const created = await a.post('/orders', draft([line(variantId, 2)]), randomUUID());
    const results = await Promise.all(
      [1, 2].map(() =>
        a.post(`/orders/${created.body.id}/confirm`, { version: created.body.version }),
      ),
    );
    expect(results.every((r) => r.status === 200 || r.status === 409)).toBe(true);
    expect(results.some((r) => r.status === 200)).toBe(true);
    expect((await balance(variantId)).reserved).toBe(2);
    expect(await db.stockReservation.count({ where: { variantId } })).toBe(1);
  });

  it('solo edita borradores, con control de versión', async () => {
    const { variantId } = await product(a, '2000.00', 5);
    const created = await a.post('/orders', draft([line(variantId, 1)]), randomUUID());
    const edited = await a.put(`/orders/${created.body.id}`, {
      version: created.body.version,
      order: draft([line(variantId, 3)]),
    });
    expect(edited.status).toBe(200);
    expect(edited.body.total).toBe('6000.00');
    expect(
      (
        await a.put(`/orders/${created.body.id}`, {
          version: created.body.version,
          order: draft([line(variantId, 2)]),
        })
      ).status,
    ).toBe(409);
    const confirmed = await a.post(`/orders/${created.body.id}/confirm`, {
      version: edited.body.version,
    });
    expect(
      (
        await a.put(`/orders/${created.body.id}`, {
          version: confirmed.body.version,
          order: draft([line(variantId, 1)]),
        })
      ).status,
    ).toBe(409);
  });

  it('conserva precios y datos históricos aunque cambien catálogo y cliente', async () => {
    const item = await product(a, '1000.00', 5);
    const customer = await a.post('/customers', {
      name: 'TEST Original',
      phone: null,
      email: null,
      notes: '',
    });
    const withAddress = await a.post(`/customers/${customer.body.id}/addresses`, {
      label: 'Oficina',
      line: 'Carrera 7 # 1-2',
      city: 'Medellín',
      notes: '',
    });
    const addressId = withAddress.body.addresses[0].id;
    const created = await a.post(
      '/orders',
      draft([line(item.variantId, 1)], {
        channel: 'DELIVERY',
        customerId: customer.body.id,
        addressId,
        deliveryFee: '8000.00',
      }),
      randomUUID(),
    );
    expect(created.status).toBe(201);
    expect(created.body.total).toBe('9000.00');
    const pending = await a.post('/orders', draft([line(item.variantId, 1)]), randomUUID());
    const current = (await a.get(`/products/${item.productId}`)).body;
    const changed = await a.put(`/products/${item.productId}`, {
      name: current.name,
      description: current.description,
      categoryId: null,
      version: current.version,
      variants: current.variants.map((v: Record<string, unknown>) => ({
        id: v.id,
        sku: v.sku,
        name: 'Renombrada',
        price: '2000.00',
        lowStockThreshold: v.lowStockThreshold,
      })),
    });
    expect(changed.status).toBe(200);
    await a.put(`/customers/${customer.body.id}`, {
      version: withAddress.body.version,
      data: { name: 'TEST Renombrado', phone: null, email: null, notes: '' },
    });
    await a.del(`/customers/${customer.body.id}/addresses/${addressId}`);
    const stored = (await a.get(`/orders/${created.body.id}`)).body;
    expect(stored.customerName).toBe('TEST Original');
    expect(stored.deliveryAddress).toContain('Carrera 7 # 1-2');
    expect(stored.lines[0]).toMatchObject({ unitPrice: '1000.00', variantName: 'Principal' });
    const stale = await a.post(`/orders/${pending.body.id}/confirm`, {
      version: pending.body.version,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('PRICE_CHANGED');
  });

  it('un domicilio exige cliente y dirección del mismo comercio', async () => {
    const { variantId } = await product(a, '1000.00', 5);
    expect(
      (await a.post('/orders', draft([line(variantId, 1)], { channel: 'DELIVERY' }), randomUUID()))
        .status,
    ).toBe(422);
    const foreign = await b.post('/customers', {
      name: 'TEST Ajeno',
      phone: null,
      email: null,
      notes: '',
    });
    const foreignAddress = await b.post(`/customers/${foreign.body.id}/addresses`, {
      label: 'Casa',
      line: 'Avenida 1 # 2-3',
      city: 'Cali',
      notes: '',
    });
    expect(
      (
        await a.post(
          '/orders',
          draft([line(variantId, 1)], {
            channel: 'DELIVERY',
            customerId: foreign.body.id,
            addressId: foreignAddress.body.addresses[0].id,
          }),
          randomUUID(),
        )
      ).status,
    ).toBe(404);
    const own = await a.post('/customers', {
      name: 'TEST Propio',
      phone: null,
      email: null,
      notes: '',
    });
    expect(
      (
        await a.post(
          '/orders',
          draft([line(variantId, 1)], {
            channel: 'DELIVERY',
            customerId: own.body.id,
            addressId: foreignAddress.body.addresses[0].id,
          }),
          randomUUID(),
        )
      ).status,
    ).toBe(404);
  });

  it('aísla clientes, pedidos y referencias entre comercios', async () => {
    const mine = await product(a, '1000.00', 5),
      theirs = await product(b, '1000.00', 5);
    const order = await confirmedOrder(a, mine.variantId, 1);
    const customer = await a.post('/customers', {
      name: 'TEST Privado',
      phone: null,
      email: null,
      notes: '',
    });
    expect((await b.get(`/orders/${order.id}`)).status).toBe(404);
    expect((await b.post(`/orders/${order.id}/complete`, { version: order.version })).status).toBe(
      404,
    );
    expect(
      (await b.post(`/orders/${order.id}/cancel`, { version: order.version, reason: 'TEST ajeno' }))
        .status,
    ).toBe(404);
    expect((await b.get(`/customers/${customer.body.id}`)).status).toBe(404);
    expect((await b.get('/orders')).body.items.some((o: { id: string }) => o.id === order.id)).toBe(
      false,
    );
    expect((await a.post('/sales', sale([line(theirs.variantId, 1)]), randomUUID())).status).toBe(
      404,
    );
    expect(
      (await a.post('/sales', sale([line(mine.variantId, 1)], '0', customer.body.id), randomUUID()))
        .status,
    ).toBe(201);
    expect(
      (
        await b.post(
          '/sales',
          sale([line(theirs.variantId, 1)], '0', customer.body.id),
          randomUUID(),
        )
      ).status,
    ).toBe(404);
    expect((await balance(theirs.variantId)).onHand).toBe(5);
    expect(
      (
        await a.post(
          '/sales',
          { ...sale([line(mine.variantId, 1)]), tenantId: 'forged' },
          randomUUID(),
        )
      ).status,
    ).toBe(422);
  });

  it('filtra pedidos por estado, canal, cliente y fecha', async () => {
    const shop = await owner('filtros');
    const { variantId } = await product(shop.client, '1000.00', 10);
    const customer = await shop.client.post('/customers', {
      name: 'TEST Filtro',
      phone: null,
      email: null,
      notes: '',
    });
    await shop.client.post(
      '/sales',
      sale([line(variantId, 1)], '0', customer.body.id),
      randomUUID(),
    );
    await shop.client.post('/orders', draft([line(variantId, 1)]), randomUUID());
    const list = async (query: string) => (await shop.client.get(`/orders?${query}`)).body;
    expect((await list('status=DRAFT')).total).toBe(1);
    expect((await list('status=COMPLETED')).total).toBe(1);
    expect((await list(`customerId=${customer.body.id}`)).total).toBe(1);
    expect((await list('search=Filtro')).total).toBe(1);
    expect((await list('search=1')).total).toBe(1);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(
      new Date(),
    );
    expect((await list(`from=${today}&to=${today}`)).total).toBe(2);
    expect((await list('from=2020-01-01&to=2020-01-02')).total).toBe(0);
    expect((await shop.client.get('/orders?from=2020-01-01')).status).toBe(422);
    expect((await shop.client.get('/orders?status=INVENTADO')).status).toBe(422);
    const detail = (await shop.client.get(`/customers/${customer.body.id}`)).body;
    expect(detail).toMatchObject({ completedOrders: 1, totalSpent: '1000.00' });
  });

  it('los reportes solo incluyen ventas completadas del comercio y neutralizan fórmulas', async () => {
    const shop = await owner('reportes');
    const { variantId } = await product(shop.client, '10000.00', 20);
    const other = await product(a, '999.00', 5);
    await a.post('/sales', sale([line(other.variantId, 1)]), randomUUID());
    const customer = await shop.client.post('/customers', {
      name: '=HYPERLINK("x")',
      phone: null,
      email: null,
      notes: '',
    });
    expect(
      (
        await shop.client.post(
          '/sales',
          sale([line(variantId, 2, '500.00')], '0', customer.body.id),
          randomUUID(),
        )
      ).status,
    ).toBe(201);
    const confirmed = await confirmedOrder(shop.client, variantId, 1);
    await shop.client.post('/orders', draft([line(variantId, 5)]), randomUUID());
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(
      new Date(),
    );
    const report = (await shop.client.get(`/reports/sales?from=${today}&to=${today}`)).body;
    expect(report).toMatchObject({
      count: 1,
      revenue: '19500.00',
      discounts: '500.00',
      units: 2,
      averageTicket: '19500.00',
    });
    expect(report.topProducts[0]).toMatchObject({ units: 2, revenue: '19500.00' });
    expect(report.daily).toEqual([{ date: today, total: '19500.00', count: 1 }]);
    expect(report.byStatus).toEqual(
      expect.arrayContaining([
        { status: 'COMPLETED', count: 1 },
        { status: 'CONFIRMED', count: 1 },
        { status: 'DRAFT', count: 1 },
      ]),
    );
    const dashboard = (await shop.client.get(`/reports/dashboard?from=${today}&to=${today}`)).body;
    expect(dashboard.sales).toMatchObject({
      todayTotal: '19500.00',
      todayCount: 1,
      monthTotal: '19500.00',
      pendingOrders: 1,
    });
    expect(confirmed.status).toBe('CONFIRMED');
    const csv = await shop.client.get(`/reports/sales.csv?from=${today}&to=${today}`);
    expect(csv.status).toBe(200);
    expect(csv.text).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv.text).not.toContain('999.00');
  });

  it('el vendedor opera ventas pero no reportes; repartidor e inventario tienen acceso limitado', async () => {
    const shop = await owner('roles');
    const { variantId } = await product(shop.client, '1000.00', 10);
    const invite = async (role: string) => {
      const email = `test-p2-${role.toLowerCase()}-${run}@example.test`;
      expect((await shop.client.post('/employees/invite', { email, role })).status).toBe(201);
      const client = await new Client().init();
      expect(
        (
          await client.post('/invitations/accept', {
            token: await mailToken(email),
            name: `TEST ${role}`,
            password,
          })
        ).status,
      ).toBe(200);
      expect((await client.post('/auth/login', { email, password })).status).toBe(200);
      return client;
    };
    const seller = await invite('SELLER');
    const created = await seller.post('/sales', sale([line(variantId, 1)]), randomUUID());
    expect(created.status).toBe(201);
    expect(created.body.createdByName).toBe('TEST SELLER');
    expect((await seller.get('/orders')).status).toBe(200);
    expect(
      (await seller.post('/customers', { name: 'TEST V', phone: null, email: null, notes: '' }))
        .status,
    ).toBe(201);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(
      new Date(),
    );
    expect((await seller.get(`/reports/sales?from=${today}&to=${today}`)).status).toBe(403);
    expect((await seller.get(`/reports/sales.csv?from=${today}&to=${today}`)).status).toBe(403);
    const stock = await invite('INVENTORY');
    expect((await stock.get('/orders')).status).toBe(200);
    expect((await stock.get('/customers')).status).toBe(403);
    expect((await stock.post('/sales', sale([line(variantId, 1)]), randomUUID())).status).toBe(403);
    const courier = await invite('COURIER');
    expect((await courier.get('/orders')).status).toBe(403);
    expect((await courier.get('/customers')).status).toBe(403);
    expect((await a.agent.post('/api/v1/sales').send({})).status).toBe(403);
    expect((await request(app).get('/api/v1/orders')).status).toBe(401);
  });

  it('MySQL impide alterar el historial de pedidos e importes inválidos', async () => {
    const { variantId } = await product(a, '1000.00', 5);
    const order = (await a.post('/sales', sale([line(variantId, 1)]), randomUUID())).body;
    const event = await db.orderEvent.findFirstOrThrow({ where: { orderId: order.id } });
    await expect(
      db.orderEvent.update({ where: { id: event.id }, data: { reason: 'TEST alterado' } }),
    ).rejects.toThrow();
    await expect(db.orderEvent.delete({ where: { id: event.id } })).rejects.toThrow();
    await expect(
      db.salesOrder.update({ where: { id: order.id }, data: { total: '-1' } }),
    ).rejects.toThrow();
    await expect(
      db.orderLine.update({ where: { id: order.lines[0].id }, data: { quantity: 0 } }),
    ).rejects.toThrow();
  });

  it('los triggers se guardan de forma que una copia con mysqldump se puede restaurar', async () => {
    const triggers = await db.$queryRaw<{ name: string; body: string }[]>`
      SELECT TRIGGER_NAME AS name, ACTION_STATEMENT AS body FROM information_schema.TRIGGERS
      WHERE TRIGGER_SCHEMA = DATABASE() ORDER BY TRIGGER_NAME`;
    expect(triggers.map((t) => t.name)).toEqual([
      'order_event_no_delete',
      'order_event_no_update',
      'stock_movement_no_delete',
      'stock_movement_no_update',
    ]);
    for (const trigger of triggers) expect(trigger.body.trimEnd()).not.toMatch(/;$/);
  });

  it('el saldo reservado coincide siempre con las reservas activas', async () => {
    const rows = await db.$queryRaw<{ variantId: string }[]>`
      SELECT b.variantId FROM InventoryBalance b
      LEFT JOIN (SELECT variantId, SUM(quantity) AS active FROM StockReservation
                 WHERE status = 'ACTIVE' GROUP BY variantId) r ON r.variantId = b.variantId
      WHERE b.tenantId = ${tenantA} AND b.reserved <> COALESCE(r.active, 0)`;
    expect(rows).toEqual([]);
    const moves = await db.$queryRaw<{ variantId: string }[]>`
      SELECT m.variantId FROM StockMovement m JOIN InventoryBalance b ON b.variantId = m.variantId
      WHERE m.tenantId = ${tenantA} GROUP BY m.variantId, b.onHand HAVING SUM(m.quantity) <> b.onHand`;
    expect(moves).toEqual([]);
  });
});
