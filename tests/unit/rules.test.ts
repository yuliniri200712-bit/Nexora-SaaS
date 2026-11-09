import { describe, it, expect } from 'vitest';
import { movementSchema, productSchema, can } from '@nexora/shared';
import { csvCell, dateRange } from '../../apps/api/src/modules/reporting/service.js';
describe('Reglas de entrada y seguridad', () => {
  it('rechaza tenant y campos privilegiados enviados en productos', () => {
    expect(
      productSchema.safeParse({
        name: 'Camisa',
        description: '',
        categoryId: null,
        tenantId: 'forged',
        variants: [{ sku: 'CAM', name: 'Principal', price: '1.00', lowStockThreshold: 0 }],
      }).success,
    ).toBe(false);
  });
  it('rechaza importes float, descuentos implícitos y SKU duplicados', () => {
    const base = {
      name: 'Camisa',
      description: '',
      categoryId: null,
      variants: [{ sku: 'cam', name: 'Principal', price: '10.50', lowStockThreshold: 0 }],
    };
    expect(productSchema.safeParse(base).success).toBe(true);
    expect(
      productSchema.safeParse({ ...base, variants: [...base.variants, ...base.variants] }).success,
    ).toBe(false);
    expect(
      productSchema.safeParse({ ...base, variants: [{ ...base.variants[0], price: 10.5 }] })
        .success,
    ).toBe(false);
  });
  it('rechaza entradas negativas, cero y fracciones', () => {
    const base = {
      variantId: '11111111-1111-4111-8111-111111111111',
      type: 'IN',
      reason: 'Recepción',
    };
    for (const quantity of [-1, 0, 0.5])
      expect(movementSchema.safeParse({ ...base, quantity }).success).toBe(false);
    expect(movementSchema.safeParse({ ...base, type: 'ADJUSTMENT', quantity: -1 }).success).toBe(
      true,
    );
  });
  it('un vendedor no puede ajustar stock ni administrar empleados', () => {
    expect(can('SELLER', 'inventory:read')).toBe(true);
    expect(can('SELLER', 'inventory:write')).toBe(false);
    expect(can('SELLER', 'employees:manage')).toBe(false);
    expect(can('COURIER', 'catalog:read')).toBe(false);
  });
  it('neutraliza fórmulas al exportar CSV', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell(' +SUM(A1)')).toContain("'");
    expect(csvCell('camisa')).toBe('"camisa"');
  });
  it('delimita días en hora colombiana y limita rangos', () => {
    const r = dateRange('2026-11-08', '2026-11-08');
    expect(r.start.toISOString()).toBe('2026-11-08T05:00:00.000Z');
    expect(r.end.toISOString()).toBe('2026-11-09T05:00:00.000Z');
    expect(() => dateRange('2026-11-09', '2026-11-08')).toThrow();
  });
});
