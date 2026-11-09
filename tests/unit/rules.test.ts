import { describe, it, expect } from 'vitest';
import {
  calculateTotals,
  can,
  fromCents,
  movementSchema,
  orderSchema,
  productSchema,
  saleSchema,
  toCents,
  TotalsError,
} from '@nexora/shared';
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
describe('Totales de pedidos', () => {
  const uuid = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
  const row = (n: number, unitPrice: string, quantity = 1, discount = '0') => ({
    variantId: uuid(n),
    unitPrice,
    quantity,
    discount,
  });
  it('convierte centavos sin pasar por coma flotante', () => {
    expect(toCents('0.1') + toCents('0.2')).toBe(30n);
    expect(toCents('1234.5')).toBe(123450n);
    expect(fromCents(5n)).toBe('0.05');
    expect(fromCents(123450n)).toBe('1234.50');
  });
  it('suma subtotal, descuentos y domicilio', () => {
    expect(calculateTotals([row(1, '19.99', 3, '0.97')], '1.00', '8000')).toMatchObject({
      subtotal: '59.97',
      discountTotal: '1.97',
      deliveryFee: '8000.00',
      total: '8058.00',
    });
  });
  it('reparte el descuento global sin perder centavos y de forma determinista', () => {
    const result = calculateTotals([row(3, '100'), row(1, '100'), row(2, '100')], '1.00', '0');
    expect(result.lines.map((l) => l.orderDiscountShare)).toEqual(['0.34', '0.33', '0.33']);
    expect(result.lines.map((l) => l.variantId)).toEqual([uuid(1), uuid(2), uuid(3)]);
    const repeated = calculateTotals([row(1, '100'), row(2, '100'), row(3, '100')], '1.00', '0');
    expect(repeated).toEqual(result);
    const net = result.lines.reduce((sum, l) => sum + toCents(l.lineTotal), 0n);
    expect(fromCents(net)).toBe(result.total);
  });
  it('prorratea según el valor de cada línea y nunca la deja negativa', () => {
    const result = calculateTotals([row(1, '0.01'), row(2, '99.99')], '100.00', '0');
    expect(result.total).toBe('0.00');
    expect(result.lines.every((l) => toCents(l.lineTotal) === 0n)).toBe(true);
  });
  it('rechaza descuentos mayores que su base', () => {
    expect(() => calculateTotals([row(1, '10', 1, '10.01')], '0', '0')).toThrow(TotalsError);
    expect(() => calculateTotals([row(1, '10', 1, '5')], '5.01', '0')).toThrow(TotalsError);
  });
  it('mantiene exactitud con importes máximos', () => {
    const result = calculateTotals([row(1, '999999999999.99', 100000)], '0', '0');
    expect(result.total).toBe('99999999999999000.00');
  });
  const line = { variantId: uuid(1), quantity: 1, discount: '0' };
  const order = {
    channel: 'COUNTER',
    customerId: null,
    addressId: null,
    lines: [line],
    discount: '0',
    deliveryFee: '0',
    notes: '',
  };
  it('valida reglas de canal y líneas de pedido', () => {
    expect(orderSchema.safeParse(order).success).toBe(true);
    expect(orderSchema.safeParse({ ...order, channel: 'DELIVERY' }).success).toBe(false);
    expect(orderSchema.safeParse({ ...order, deliveryFee: '1000' }).success).toBe(false);
    expect(orderSchema.safeParse({ ...order, lines: [] }).success).toBe(false);
    expect(orderSchema.safeParse({ ...order, lines: [line, line] }).success).toBe(false);
    expect(orderSchema.safeParse({ ...order, lines: [{ ...line, quantity: 0.5 }] }).success).toBe(
      false,
    );
    expect(orderSchema.safeParse({ ...order, discount: 10 }).success).toBe(false);
    expect(
      saleSchema.safeParse({
        customerId: null,
        lines: [line],
        discount: '0',
        notes: '',
        tenantId: uuid(9),
      }).success,
    ).toBe(false);
  });
  it('concede ventas al vendedor y no al repartidor', () => {
    expect(can('SELLER', 'orders:write')).toBe(true);
    expect(can('SELLER', 'reports:read')).toBe(false);
    expect(can('INVENTORY', 'orders:write')).toBe(false);
    expect(can('COURIER', 'orders:read')).toBe(false);
    expect(can('COURIER', 'customers:read')).toBe(false);
  });
});
