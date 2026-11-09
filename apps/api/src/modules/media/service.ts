import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { dataPath } from '../../core/config.js';
import type { TenantContext } from '../../core/context.js';
import { assert } from '../../core/errors.js';
import { db, transaction } from '../../infrastructure/database.js';
import { audit } from '../../infrastructure/audit.js';
export async function upload(context: TenantContext, productId: string, buffer: Buffer) {
  assert(
    await db.product.findFirst({
      where: { id: productId, tenantId: context.tenantId, active: true },
    }),
    404,
    'NOT_FOUND',
    'Producto no disponible.',
  );
  const image = sharp(buffer, { limitInputPixels: 16000000 });
  const metadata = await image.metadata().catch(() => null);
  assert(
    metadata && ['jpeg', 'png', 'webp'].includes(metadata.format),
    422,
    'INVALID_IMAGE',
    'Usa una imagen JPEG, PNG o WebP válida de hasta 16 megapíxeles.',
  );
  const output = await image
    .rotate()
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
  const objectKey = `${randomUUID()}.webp`,
    dir = resolve(dataPath, 'uploads', context.tenantId);
  await mkdir(dir, { recursive: true });
  const file = resolve(dir, objectKey);
  await writeFile(file, output);
  try {
    return await transaction(async (tx) => {
      const entry = await tx.productImage.upsert({
        where: { productId },
        create: { tenantId: context.tenantId, productId, objectKey, size: output.length },
        update: { objectKey, size: output.length },
      });
      await audit(tx, context, 'product.image.uploaded', productId);
      return { id: entry.id };
    });
  } catch (error) {
    await unlink(file).catch(() => undefined);
    throw error;
  }
}
export async function imagePath(context: TenantContext, id: string) {
  const item = await db.productImage.findFirst({ where: { id, tenantId: context.tenantId } });
  assert(item, 404, 'NOT_FOUND', 'Imagen no disponible.');
  return resolve(dataPath, 'uploads', context.tenantId, item.objectKey);
}
