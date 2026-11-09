import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
async function addProduct(page: Page, sku: string, quantity: number) {
  await page.getByRole('link', { name: 'Productos', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo producto', exact: true }).click();
  await page.getByLabel('Nombre del producto').fill('TEST Camisa de lino');
  await page.getByLabel('SKU', { exact: true }).fill(sku);
  await page.getByLabel('Precio (COP)').fill('85000');
  await page.getByRole('button', { name: 'Guardar producto' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('link', { name: 'Inventario', exact: true }).click();
  await page.getByRole('button', { name: 'Registrar movimiento' }).click();
  const select = page.getByRole('combobox', { name: 'Producto y variante', exact: true });
  await expect(select.locator('option', { hasText: sku.toUpperCase() })).toHaveCount(1);
  await select.selectOption({
    label: await select.locator('option', { hasText: sku.toUpperCase() }).innerText(),
  });
  await page.getByLabel('Cantidad', { exact: true }).fill(String(quantity));
  await page.getByLabel('Motivo').fill('TEST recepción inicial');
  await page.getByRole('button', { name: 'Confirmar movimiento' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
}
async function pickProduct(page: Page, sku: string) {
  const select = page.getByRole('combobox', { name: 'Agregar producto', exact: true }),
    option = select.locator('option', { hasText: sku.toUpperCase() });
  await expect(option).toHaveCount(1);
  await select.selectOption((await option.getAttribute('value')) ?? '');
}
test('cliente, pedido con reserva, venta directa, reportes y móvil', async ({ page }) => {
  test.setTimeout(180000);
  const suffix = randomUUID().slice(0, 8),
    sku = `E2E-${suffix}`;
  await page.goto('/registro');
  await page.getByLabel('Tu nombre').fill('TEST Comercio');
  await page.getByLabel('Nombre del negocio').fill(`TEST Ventas ${suffix}`);
  await page.getByLabel('Correo electrónico').fill(`test-ventas-${suffix}@example.test`);
  await page.getByLabel('Contraseña', { exact: true }).fill('Nexora-E2E-Only-2026!');
  await page.getByRole('button', { name: 'Crear mi cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Hola, TEST.' })).toBeVisible();
  await addProduct(page, sku, 10);

  await page.getByRole('link', { name: 'Clientes', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo cliente' }).click();
  await page.getByLabel('Nombre del cliente').fill('TEST Ana Pérez');
  await page.getByLabel('Teléfono').fill('3001234567');
  await page.getByRole('button', { name: 'Guardar cliente' }).click();
  await expect(page.getByRole('cell', { name: 'TEST Ana Pérez', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ver TEST Ana Pérez' }).click();
  await page.getByLabel('Nombre de la dirección').fill('Casa');
  await page.getByLabel('Ciudad').fill('Bogotá');
  await page.getByLabel('Dirección', { exact: true }).fill('Calle 10 # 20-30');
  await page.getByRole('button', { name: 'Agregar dirección' }).click();
  await expect(page.getByText('Calle 10 # 20-30, Bogotá')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();

  await page.getByRole('link', { name: 'Pedidos', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo pedido' }).click();
  await page.getByRole('combobox', { name: 'Cliente', exact: true }).selectOption({ index: 1 });
  await page.getByLabel('Entrega').selectOption('DELIVERY');
  await page.getByLabel('Dirección de entrega').selectOption({ index: 1 });
  await page.getByLabel('Costo de domicilio (COP)').fill('8000');
  await pickProduct(page, sku);
  await page.getByLabel('Cantidad', { exact: true }).fill('3');
  await expect(page.locator('.totals-grand dd')).toContainText('263.000');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('cell', { name: 'Borrador' })).toBeVisible();

  await page.getByRole('button', { name: 'Ver pedido 1' }).click();
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await expect(page.getByRole('button', { name: 'Completar pedido' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('link', { name: 'Inventario', exact: true }).click();
  await expect(page.getByRole('row', { name: new RegExp(sku.toUpperCase()) })).toContainText('7');

  await page.getByRole('link', { name: 'Pedidos', exact: true }).click();
  await page.getByRole('button', { name: 'Ver pedido 1' }).click();
  await page.getByRole('button', { name: 'Completar pedido' }).click();
  await expect(page.getByRole('dialog').locator('.badge.success')).toHaveText('Completado');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();

  await page.getByRole('link', { name: 'Ventas', exact: true }).click();
  await page.getByRole('button', { name: 'Nueva venta' }).click();
  await pickProduct(page, sku);
  await page.getByLabel('Descuento general (COP)').fill('5000');
  await expect(page.locator('.totals-grand dd')).toContainText('80.000');
  await page.getByRole('button', { name: 'Registrar venta' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('cell', { name: '#2' })).toBeVisible();

  await page.getByRole('link', { name: 'Inventario', exact: true }).click();
  await expect(page.getByRole('row', { name: new RegExp(sku.toUpperCase()) })).toContainText('6');
  await page.getByRole('link', { name: 'Vista general', exact: true }).click();
  await expect(page.getByText('Ventas de hoy')).toBeVisible();
  const salesChart = page.getByRole('img', { name: /ventas completadas por día/ });
  await expect(salesChart.locator('.recharts-bar-rectangle path').first()).toBeVisible();
  await expect(page.locator('.metric-card', { hasText: 'Ventas de hoy' })).toContainText('343.000');
  await page.getByRole('link', { name: 'Reportes', exact: true }).click();
  await expect(page.locator('.metric-card', { hasText: 'Ingresos del periodo' })).toContainText(
    '343.000',
  );

  await page.reload();
  await expect(page.locator('.metric-card', { hasText: 'Unidades vendidas' })).toContainText('4');
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/ventas', '/pedidos', '/clientes', '/reportes', '/']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await noOverflow(page), `${path} a ${width}px`).toBe(true);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/pedidos');
  await page.getByRole('button', { name: 'Ver pedido 1' }).click();
  await expect(page.getByRole('dialog').getByText('Calle 10 # 20-30')).toBeVisible();
  await page.screenshot({ path: 'test-results/order-detail-mobile.png' });
});
