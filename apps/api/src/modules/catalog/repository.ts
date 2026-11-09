import { Prisma } from '@prisma/client';
import type { ProductInput, ProductDto } from '@nexora/shared';
import { db, transaction } from '../../infrastructure/database.js';
import { audit } from '../../infrastructure/audit.js';
import type { TenantContext } from '../../core/context.js';
import { assert } from '../../core/errors.js';
const include = {
  category: true,
  variants: { include: { balance: true } },
  image: { select: { id: true } },
} satisfies Prisma.ProductInclude;
type ProductRecord = Prisma.ProductGetPayload<{ include: typeof include }>;
const dto = (p: ProductRecord): ProductDto => ({
  id: p.id,
  name: p.name,
  description: p.description,
  active: p.active,
  version: p.version,
  category: p.category ? { id: p.category.id, name: p.category.name } : null,
  imageId: p.image?.id ?? null,
  variants: p.variants.map((v) => ({
    id: v.id,
    name: v.name,
    sku: v.sku,
    price: v.price.toFixed(2),
    lowStockThreshold: v.lowStockThreshold,
    balance: v.balance
      ? { onHand: v.balance.onHand, reserved: v.balance.reserved, version: v.balance.version }
      : null,
  })),
});
export async function list(
  context: TenantContext,
  filter: { search: string; page: number; categoryId?: string; archived: boolean },
) {
  const where: Prisma.ProductWhereInput = {
    tenantId: context.tenantId,
    active: !filter.archived,
    ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
    ...(filter.search
      ? {
          OR: [
            { name: { contains: filter.search } },
            { variants: { some: { sku: { contains: filter.search } } } },
          ],
        }
      : {}),
  };
  const [items, total] = await db.$transaction([
    db.product.findMany({
      where,
      include,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (filter.page - 1) * 20,
      take: 20,
    }),
    db.product.count({ where }),
  ]);
  return { items: items.map(dto), total, page: filter.page, pageSize: 20 };
}
export async function get(context: TenantContext, id: string) {
  const product = await db.product.findFirst({
    where: { tenantId: context.tenantId, id },
    include,
  });
  assert(product, 404, 'NOT_FOUND', 'Producto no disponible.');
  return dto(product);
}
export async function save(
  context: TenantContext,
  input: ProductInput,
  id?: string,
  version?: number,
) {
  const productId = await transaction(async (tx) => {
    if (input.categoryId)
      assert(
        await tx.category.findFirst({
          where: { id: input.categoryId, tenantId: context.tenantId },
        }),
        404,
        'NOT_FOUND',
        'Categoría no disponible.',
      );
    const location = await tx.location.findUniqueOrThrow({ where: { tenantId: context.tenantId } });
    let product;
    if (id) {
      const previous = await tx.product.findFirst({
        where: { tenantId: context.tenantId, id },
        include: { variants: true },
      });
      assert(previous, 404, 'NOT_FOUND', 'Producto no disponible.');
      assert(previous.active, 409, 'ARCHIVED', 'Restaura el producto antes de editarlo.');
      assert(
        previous.variants.every((v) => input.variants.some((i) => i.id === v.id)),
        422,
        'VARIANTS_REQUIRED',
        'Conserva las variantes existentes para mantener la trazabilidad.',
      );
      assert(
        input.variants.every((v) => !v.id || previous.variants.some((i) => i.id === v.id)),
        404,
        'NOT_FOUND',
        'Variante no disponible.',
      );
      const changed = await tx.product.updateMany({
        where: { id, tenantId: context.tenantId, version },
        data: {
          name: input.name,
          description: input.description,
          categoryId: input.categoryId,
          version: { increment: 1 },
        },
      });
      assert(
        changed.count === 1,
        409,
        'STALE_VERSION',
        'Otro usuario modificó el producto. Actualiza e intenta de nuevo.',
      );
      product = previous;
    } else {
      assert(
        input.variants.every((v) => !v.id),
        422,
        'INVALID_VARIANT',
        'No se pueden reutilizar variantes al crear productos.',
      );
      product = await tx.product.create({
        data: {
          tenantId: context.tenantId,
          name: input.name,
          description: input.description,
          categoryId: input.categoryId,
        },
      });
    }
    for (const variant of input.variants) {
      if (variant.id) {
        await tx.productVariant.update({
          where: { tenantId_id: { tenantId: context.tenantId, id: variant.id } },
          data: {
            name: variant.name,
            sku: variant.sku,
            price: variant.price,
            lowStockThreshold: variant.lowStockThreshold,
          },
        });
      } else {
        await tx.productVariant.create({
          data: {
            tenantId: context.tenantId,
            productId: product.id,
            name: variant.name,
            sku: variant.sku,
            price: variant.price,
            lowStockThreshold: variant.lowStockThreshold,
            balance: { create: { locationId: location.id } },
          },
        });
      }
    }
    await audit(tx, context, id ? 'product.updated' : 'product.created', product.id);
    return product.id;
  });
  return get(context, productId);
}
export async function setActive(
  context: TenantContext,
  id: string,
  active: boolean,
  version: number,
) {
  await transaction(async (tx) => {
    const current = await tx.product.findFirst({
      where: { tenantId: context.tenantId, id },
      include: { variants: { include: { balance: true } } },
    });
    assert(current, 404, 'NOT_FOUND', 'Producto no disponible.');
    if (!active)
      assert(
        current.variants.every((v) => !v.balance || v.balance.onHand === 0),
        409,
        'STOCK_REMAINS',
        'Registra la salida o ajuste de existencias antes de archivar.',
      );
    const updated = await tx.product.updateMany({
      where: { tenantId: context.tenantId, id, version },
      data: { active, version: { increment: 1 } },
    });
    assert(updated.count === 1, 409, 'STALE_VERSION', 'El producto cambió. Actualiza la página.');
    await audit(tx, context, active ? 'product.restored' : 'product.archived', id);
  });
}
export const categories = (context: TenantContext) =>
  db.category.findMany({
    where: { tenantId: context.tenantId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });
export async function saveCategory(context: TenantContext, name: string, id?: string) {
  return transaction(async (tx) => {
    let result;
    if (id) {
      assert(
        await tx.category.findFirst({ where: { id, tenantId: context.tenantId } }),
        404,
        'NOT_FOUND',
        'Categoría no disponible.',
      );
      result = await tx.category.update({
        where: { tenantId_id: { tenantId: context.tenantId, id } },
        data: { name },
      });
    } else result = await tx.category.create({ data: { name, tenantId: context.tenantId } });
    await audit(tx, context, 'category.saved', result.id);
    return result;
  });
}
export async function deleteCategory(context: TenantContext, id: string) {
  await transaction(async (tx) => {
    assert(
      await tx.category.findFirst({ where: { id, tenantId: context.tenantId } }),
      404,
      'NOT_FOUND',
      'Categoría no disponible.',
    );
    assert(
      (await tx.product.count({ where: { tenantId: context.tenantId, categoryId: id } })) === 0,
      409,
      'CATEGORY_IN_USE',
      'La categoría tiene productos asociados.',
    );
    await tx.category.delete({ where: { tenantId_id: { tenantId: context.tenantId, id } } });
    await audit(tx, context, 'category.deleted', id);
  });
}
