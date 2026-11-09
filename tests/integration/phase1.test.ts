import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { app } from '../../apps/api/src/app.js';
import { db } from '../../apps/api/src/infrastructure/database.js';
import { config, dataPath } from '../../apps/api/src/core/config.js';
import { hash } from '../../apps/api/src/core/crypto.js';

const run = randomUUID().slice(0, 8),
  password = 'Nexora-Test-Only-2026!';
class Client {
  agent = request.agent(app);
  csrf = '';
  async init() {
    this.csrf = (await this.agent.get('/api/v1/auth/csrf')).body.csrfToken;
  }
  get(path: string) {
    return this.agent.get(`/api/v1${path}`);
  }
  post(path: string, body: unknown, key?: string) {
    const r = this.agent
      .post(`/api/v1${path}`)
      .set('Origin', config.APP_ORIGIN)
      .set('X-CSRF-Token', this.csrf);
    if (key) r.set('Idempotency-Key', key);
    return r.send(body);
  }
  put(path: string, body: unknown) {
    return this.agent
      .put(`/api/v1${path}`)
      .set('Origin', config.APP_ORIGIN)
      .set('X-CSRF-Token', this.csrf)
      .send(body);
  }
  patch(path: string, body: unknown) {
    return this.agent
      .patch(`/api/v1${path}`)
      .set('Origin', config.APP_ORIGIN)
      .set('X-CSRF-Token', this.csrf)
      .send(body);
  }
}
const a = new Client(),
  b = new Client();
let tenantA = '',
  tenantB = '',
  membershipA = '',
  categoryA = '',
  categoryB = '',
  productA = '',
  productB = '',
  variantA = '';
const productInput = (categoryId: string, sku: string) => ({
  name: `TEST ${sku}`,
  description: 'Fixture de integración; no son datos reales.',
  categoryId,
  variants: [{ sku, name: 'Principal', price: '49900.50', lowStockThreshold: 2 }],
});
async function mailToken(email: string) {
  const dir = resolve(dataPath, 'mailbox');
  const names = (await readdir(dir)).sort().reverse();
  for (const name of names) {
    const body = JSON.parse(await readFile(resolve(dir, name), 'utf8'));
    if (body.to === email) {
      const match = body.text.match(/token=([a-f0-9]{64})/);
      if (match) return match[1] as string;
    }
  }
  throw new Error('No se encontró correo de prueba.');
}
describe('Fase 1 contra MySQL real', () => {
  beforeAll(async () => {
    await a.init();
    await b.init();
    expect(
      (
        await a.post('/auth/register', {
          name: 'TEST Propietario A',
          businessName: `TEST Comercio A ${run}`,
          email: `test-a-${run}@example.test`,
          password,
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await b.post('/auth/register', {
          name: 'TEST Propietario B',
          businessName: `TEST Comercio B ${run}`,
          email: `test-b-${run}@example.test`,
          password,
        })
      ).status,
    ).toBe(201);
    const userA = (await a.get('/auth/session')).body.user,
      userB = (await b.get('/auth/session')).body.user;
    tenantA = userA.tenant.id;
    tenantB = userB.tenant.id;
    membershipA = userA.membershipId;
    categoryA = (await a.post('/categories', { name: 'TEST Ropa' })).body.id;
    categoryB = (await b.post('/categories', { name: 'TEST Privada B' })).body.id;
    const pa = await a.post('/products', productInput(categoryA, `A-${run}`));
    expect(pa.status).toBe(201);
    productA = pa.body.id;
    variantA = pa.body.variants[0].id;
    const pb = await b.post('/products', productInput(categoryB, `B-${run}`));
    expect(pb.status).toBe(201);
    productB = pb.body.id;
  });
  afterAll(async () => {
    await db.$disconnect();
  });
  it('persiste productos y precios decimales entre conexiones', async () => {
    await db.$disconnect();
    const response = await a.get(`/products/${productA}`);
    expect(response.status).toBe(200);
    expect(response.body.variants[0].price).toBe('49900.50');
    expect(response.body.category.name).toBe('TEST Ropa');
  });
  it('aísla listas, lecturas, ediciones, archivos y categorías', async () => {
    const list = await a.get('/products');
    expect(list.body.items.some((p: { id: string }) => p.id === productB)).toBe(false);
    expect((await a.get(`/products/${productB}`)).status).toBe(404);
    expect(
      (await a.put(`/products/${productB}`, { ...productInput(categoryB, `B-${run}`), version: 0 }))
        .status,
    ).toBe(404);
    expect(
      (await a.patch(`/products/${productB}/status`, { active: false, version: 0 })).status,
    ).toBe(404);
    expect((await a.post('/products', productInput(categoryB, `CROSS-${run}`))).status).toBe(404);
    expect((await a.get('/categories')).body.some((c: { id: string }) => c.id === categoryB)).toBe(
      false,
    );
  });
  it('rechaza manipulación de tenant y rol en cuerpos', async () => {
    expect(
      (
        await a.post('/products', {
          ...productInput(categoryA, `FORGED-${run}`),
          tenantId: tenantB,
        })
      ).status,
    ).toBe(422);
    expect(
      (await a.post('/auth/switch', { membershipId: membershipA, role: 'OWNER' })).status,
    ).toBe(422);
  });
  it('MySQL impide claves foráneas cruzadas y stock negativo incluso fuera de la API', async () => {
    await expect(
      db.product.create({
        data: {
          tenantId: tenantA,
          categoryId: categoryB,
          name: 'TEST FK forbidden',
          description: '',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    const memberB = await db.membership.findFirstOrThrow({ where: { tenantId: tenantB } });
    await expect(
      db.session.create({
        data: {
          tenantId: tenantA,
          membershipId: memberB.id,
          tokenHash: 'a'.repeat(64),
          expiresAt: new Date(Date.now() + 1000),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      db.inventoryBalance.update({ where: { variantId: variantA }, data: { onHand: -1 } }),
    ).rejects.toThrow();
  });
  it('revierte una transacción completa ante un fallo', async () => {
    const name = `TEST rollback ${run}`;
    await expect(
      db.$transaction(async (tx) => {
        await tx.category.create({ data: { tenantId: tenantA, name } });
        throw new Error('fallo controlado');
      }),
    ).rejects.toThrow('fallo controlado');
    expect(await db.category.count({ where: { tenantId: tenantA, name } })).toBe(0);
  });
  it('comprueba origen y token CSRF antes de mutar', async () => {
    expect((await a.agent.post('/api/v1/categories').send({ name: 'TEST CSRF' })).status).toBe(403);
    expect(
      (
        await a.agent
          .post('/api/v1/categories')
          .set('Origin', 'https://attacker.example')
          .set('X-CSRF-Token', a.csrf)
          .send({ name: 'TEST CSRF' })
      ).status,
    ).toBe(403);
  });
  it('dos salidas por la última unidad producen un solo consumo', async () => {
    expect(
      (
        await a.post(
          '/inventory/movements',
          { variantId: variantA, type: 'IN', quantity: 1, reason: 'TEST última unidad' },
          randomUUID(),
        )
      ).status,
    ).toBe(201);
    const body = {
      variantId: variantA,
      type: 'OUT',
      quantity: 1,
      reason: 'TEST salida concurrente',
    };
    const results = await Promise.all([
      a.post('/inventory/movements', body, randomUUID()),
      a.post('/inventory/movements', body, randomUUID()),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(
      (await db.inventoryBalance.findUniqueOrThrow({ where: { variantId: variantA } })).onHand,
    ).toBe(0);
    expect(
      await db.stockMovement.count({
        where: { tenantId: tenantA, variantId: variantA, type: 'OUT' },
      }),
    ).toBe(1);
  });
  it('reintentar un movimiento no lo duplica; cambiar su cuerpo es conflicto', async () => {
    const key = randomUUID(),
      body = { variantId: variantA, type: 'IN', quantity: 3, reason: 'TEST reintento' };
    const first = await a.post('/inventory/movements', body, key),
      second = await a.post('/inventory/movements', body, key);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect((await a.post('/inventory/movements', { ...body, quantity: 9 }, key)).status).toBe(409);
    expect(
      (await db.inventoryBalance.findUniqueOrThrow({ where: { variantId: variantA } })).onHand,
    ).toBe(3);
    expect(
      await db.auditEvent.count({
        where: { tenantId: tenantA, action: 'inventory.moved', resourceId: first.body.id },
      }),
    ).toBe(1);
  });
  it('rechaza movimientos de otro comercio y sobreajustes', async () => {
    expect(
      (
        await b.post(
          '/inventory/movements',
          { variantId: variantA, type: 'IN', quantity: 1, reason: 'TEST acceso cruzado' },
          randomUUID(),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await a.post(
          '/inventory/movements',
          { variantId: variantA, type: 'ADJUSTMENT', quantity: -4, reason: 'TEST ajuste inválido' },
          randomUUID(),
        )
      ).status,
    ).toBe(409);
  });
  it('detecta una edición obsoleta y conserva SKU e historial', async () => {
    const current = (await a.get(`/products/${productA}`)).body;
    const body = {
      ...productInput(categoryA, `A-${run}`),
      name: 'TEST Camisa actualizada',
      version: current.version,
      variants: current.variants.map(
        (v: {
          id: string;
          name: string;
          sku: string;
          price: string;
          lowStockThreshold: number;
        }) => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          price: v.price,
          lowStockThreshold: v.lowStockThreshold,
        }),
      ),
    };
    expect((await a.put(`/products/${productA}`, body)).status).toBe(200);
    expect((await a.put(`/products/${productA}`, body)).status).toBe(409);
    expect(
      (await a.patch(`/products/${productA}/status`, { active: false, version: 1 })).status,
    ).toBe(409);
  });
  it('permite archivar y restaurar un producto sin existencias', async () => {
    const p = (await a.post('/products', productInput(categoryA, `EMPTY-${run}`))).body;
    expect(
      (await a.patch(`/products/${p.id}/status`, { active: false, version: p.version })).status,
    ).toBe(200);
    expect(
      (await a.get('/products?archived=true')).body.items.some(
        (v: { id: string }) => v.id === p.id,
      ),
    ).toBe(true);
    expect(
      (await a.patch(`/products/${p.id}/status`, { active: true, version: p.version + 1 })).status,
    ).toBe(200);
  });
  it('sirve imágenes privadas y rechaza SVG o bytes falsos', async () => {
    const buffer = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#00b9b1' },
    })
      .png()
      .toBuffer();
    const upload = await a.agent
      .post(`/api/v1/products/${productA}/image`)
      .set('Origin', config.APP_ORIGIN)
      .set('X-CSRF-Token', a.csrf)
      .attach('image', buffer, 'test.png');
    expect(upload.status).toBe(201);
    expect((await a.get(`/images/${upload.body.id}`)).status).toBe(200);
    expect((await b.get(`/images/${upload.body.id}`)).status).toBe(404);
    const invalid = await a.agent
      .post(`/api/v1/products/${productA}/image`)
      .set('Origin', config.APP_ORIGIN)
      .set('X-CSRF-Token', a.csrf)
      .attach('image', Buffer.from('<svg></svg>'), 'test.svg');
    expect(invalid.status).toBe(422);
  });
  it('reportes y exportación muestran solo el comercio autorizado', async () => {
    const csv = await a.get('/reports/inventory.csv');
    expect(csv.status).toBe(200);
    expect(csv.text).toContain(`A-${run.toUpperCase()}`);
    expect(csv.text).not.toContain(`B-${run.toUpperCase()}`);
    const date = new Date().toISOString().slice(0, 10);
    const report = await a.get(`/reports/dashboard?from=${date}&to=${date}`);
    expect(report.status).toBe(200);
    expect(report.body.units).toBe(3);
  });
  it('invita un vendedor, limita permisos y revoca sus sesiones al desactivar', async () => {
    const email = `test-seller-${run}@example.test`;
    expect((await a.post('/employees/invite', { email, role: 'SELLER' })).status).toBe(201);
    const invited = new Client();
    await invited.init();
    const invitation = await mailToken(email);
    expect(
      (
        await invited.post('/invitations/accept', {
          token: invitation,
          name: 'TEST Vendedor',
          password,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await invited.post('/invitations/accept', {
          token: invitation,
          name: 'TEST Vendedor',
          password,
        })
      ).status,
    ).toBe(400);
    expect((await invited.post('/auth/login', { email, password })).status).toBe(200);
    expect((await invited.get('/products')).status).toBe(200);
    expect((await invited.get('/employees')).status).toBe(403);
    expect((await invited.get('/reports/inventory.csv')).status).toBe(403);
    expect(
      (
        await invited.post(
          '/inventory/movements',
          { variantId: variantA, type: 'IN', quantity: 1, reason: 'TEST sin permiso' },
          randomUUID(),
        )
      ).status,
    ).toBe(403);
    const member = (await invited.get('/auth/session')).body.user.membershipId;
    expect((await a.patch(`/employees/${member}`, { role: 'SELLER', active: false })).status).toBe(
      200,
    );
    expect((await invited.get('/products')).status).toBe(401);
    expect(
      (await a.patch(`/employees/${membershipA}`, { role: 'ADMIN', active: false })).status,
    ).toBe(403);
  });
  it('rota sesiones y rechaza la cookie anterior', async () => {
    const client = new Client();
    await client.init();
    const login = await client.post('/auth/login', {
      email: `test-a-${run}@example.test`,
      password,
    });
    const old = login.headers['set-cookie'];
    expect((await client.post('/auth/renew', {})).status).toBe(200);
    expect((await request(app).get('/api/v1/auth/session').set('Cookie', old)).status).toBe(401);
    expect((await client.post('/auth/logout', {})).status).toBe(200);
    expect((await client.get('/auth/session')).status).toBe(401);
  });
  it('cambia de comercio solo mediante una membresía propia y validada', async () => {
    const client = new Client();
    await client.init();
    const email = `test-a-${run}@example.test`;
    await client.post('/auth/login', { email, password });
    const memberB = await db.membership.findFirstOrThrow({
      where: { tenantId: tenantB, role: 'OWNER' },
    });
    expect((await client.post('/auth/switch', { membershipId: memberB.id })).status).toBe(404);
    expect((await b.post('/employees/invite', { email, role: 'INVENTORY' })).status).toBe(201);
    expect(
      (
        await client.post('/invitations/accept', {
          token: await mailToken(email),
          name: 'TEST Propietario A',
          password,
        })
      ).status,
    ).toBe(200);
    const own = (await client.get('/auth/session')).body.user.memberships.find(
      (m: { tenantId: string }) => m.tenantId === tenantB,
    );
    expect((await client.post('/auth/switch', { membershipId: own.id })).status).toBe(200);
    expect((await client.get(`/products/${productA}`)).status).toBe(404);
    expect((await client.get(`/products/${productB}`)).status).toBe(200);
    expect((await client.get('/employees')).status).toBe(403);
  });
  it('rechaza sesiones expiradas por inactividad y por duración absoluta', async () => {
    for (const field of ['lastSeenAt', 'expiresAt'] as const) {
      const client = new Client();
      await client.init();
      const response = await client.post('/auth/login', {
        email: `test-a-${run}@example.test`,
        password,
      });
      const cookies = response.headers['set-cookie'] as unknown as string[];
      const raw = cookies
        .find((c) => c.startsWith('nexora_session='))
        ?.split(';')[0]
        ?.split('=')[1];
      expect(raw).toBeTruthy();
      await db.session.update({
        where: { tokenHash: hash(raw!) },
        data: { [field]: new Date(Date.now() - 3600000) },
      });
      expect((await client.get('/auth/session')).status).toBe(401);
    }
  });
  it('recupera contraseña una sola vez y revoca sesiones previas', async () => {
    const email = `test-b-${run}@example.test`;
    expect((await b.post('/auth/forgot', { email })).status).toBe(200);
    const reset = await mailToken(email);
    expect(
      (await b.post('/auth/reset', { token: reset, password: 'Changed-Test-Only-2026!' })).status,
    ).toBe(200);
    expect((await b.get('/auth/session')).status).toBe(401);
    expect((await b.post('/auth/reset', { token: reset, password })).status).toBe(400);
    expect((await b.post('/auth/login', { email, password })).status).toBe(401);
    expect(
      (await b.post('/auth/login', { email, password: 'Changed-Test-Only-2026!' })).status,
    ).toBe(200);
  });
  it('solicitudes simultáneas con la misma clave crean un solo movimiento', async () => {
    const product = await a.post('/products', productInput(categoryA, `IDEM-${run}`));
    const variantId: string = product.body.variants[0].id;
    const rounds = 5;
    for (let round = 0; round < rounds; round++) {
      const key = randomUUID(),
        body = { variantId, type: 'IN', quantity: 2, reason: 'TEST misma clave' };
      const results = await Promise.all(
        [1, 2, 3].map(() => a.post('/inventory/movements', body, key)),
      );
      expect(results.map((r) => r.status)).toEqual([201, 201, 201]);
      expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
      expect(
        await db.auditEvent.count({
          where: { tenantId: tenantA, action: 'inventory.moved', resourceId: results[0]!.body.id },
        }),
      ).toBe(1);
    }
    expect(await db.stockMovement.count({ where: { tenantId: tenantA, variantId } })).toBe(rounds);
    expect((await db.inventoryBalance.findUniqueOrThrow({ where: { variantId } })).onHand).toBe(
      rounds * 2,
    );
  });
  it('aceptar invitaciones usa el límite estricto de credenciales', async () => {
    const client = new Client();
    await client.init();
    const response = await client.post('/invitations/accept', {
      token: 'f'.repeat(64),
      name: 'TEST Invitación inválida',
      password,
    });
    expect(response.status).toBe(400);
    expect(String(response.headers['ratelimit-policy'])).toContain('w=900');
  });
  it('MySQL impide modificar o borrar movimientos históricos fuera de la API', async () => {
    const movement = await db.stockMovement.findFirstOrThrow({ where: { tenantId: tenantA } });
    await expect(
      db.stockMovement.update({ where: { id: movement.id }, data: { reason: 'TEST alterado' } }),
    ).rejects.toThrow();
    await expect(db.stockMovement.delete({ where: { id: movement.id } })).rejects.toThrow();
    const stored = await db.stockMovement.findUniqueOrThrow({ where: { id: movement.id } });
    expect(stored.reason).toBe(movement.reason);
    expect(stored.quantity).toBe(movement.quantity);
  });
});
