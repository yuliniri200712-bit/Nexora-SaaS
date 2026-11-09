import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
test('comercio nuevo, categoría, producto, stock, persistencia y móvil', async ({ page }) => {
  const suffix = randomUUID().slice(0, 8),
    email = `test-e2e-${suffix}@example.test`;
  await page.goto('/registro');
  await page.getByLabel('Tu nombre').fill('TEST Comercio');
  await page.getByLabel('Nombre del negocio').fill(`TEST Navegador ${suffix}`);
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill('Nexora-E2E-Only-2026!');
  await page.getByRole('button', { name: 'Crear mi cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Hola, TEST.' })).toBeVisible();
  await page.getByRole('link', { name: 'Categorías', exact: true }).click();
  await page.getByRole('button', { name: 'Nueva categoría' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('TEST Camisas');
  await page.getByRole('button', { name: 'Guardar categoría' }).click();
  await expect(page.getByRole('heading', { name: 'TEST Camisas' })).toBeVisible();
  await page.getByRole('link', { name: 'Productos', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo producto', exact: true }).click();
  await page.getByLabel('Nombre del producto').fill('TEST Camisa de lino');
  await page
    .getByRole('combobox', { name: 'Categoría', exact: true })
    .selectOption({ label: 'TEST Camisas' });
  await page.getByLabel('SKU', { exact: true }).fill(`LIN-${suffix}`);
  await page.getByLabel('Precio (COP)').fill('85000');
  await page.getByRole('button', { name: 'Guardar producto' }).click();
  await expect(
    page.getByRole('table').getByText('TEST Camisa de lino', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Inventario', exact: true }).click();
  await page.getByRole('button', { name: 'Registrar movimiento' }).click();
  await page.getByRole('combobox', { name: 'Producto y variante', exact: true }).selectOption({
    label: `TEST Camisa de lino · Principal · LIN-${suffix.toUpperCase()} (0 uds.)`,
  });
  await page.getByLabel('Cantidad', { exact: true }).fill('12');
  await page.getByLabel('Motivo').fill('TEST recepción inicial');
  await page.getByRole('button', { name: 'Confirmar movimiento' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByText('En equilibrio', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('En equilibrio', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Movimientos', exact: true }).click();
  await expect(page.getByRole('cell', { name: /TEST recepción inicial/ })).toBeVisible();
  await page.getByRole('link', { name: 'Vista general', exact: true }).click();
  await expect(page.getByText('12', { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { name: 'Hola, TEST.' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Qué bueno tenerte aquí.' })).toBeVisible();
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill('Nexora-E2E-Only-2026!');
  await page.getByRole('button', { name: 'Entrar a mi negocio' }).click();
  await expect(page.getByRole('heading', { name: 'Hola, TEST.' })).toBeVisible();
});
