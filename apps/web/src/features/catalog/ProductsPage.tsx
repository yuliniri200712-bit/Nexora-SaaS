import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Package, Pencil, Archive, RotateCcw, ImagePlus, X } from 'lucide-react';
import { can, productSchema } from '@nexora/shared';
import type { ProductDto, CategoryDto, ProductInput } from '@nexora/shared';
import { api, json, money } from '../../lib/api';
import { useSession } from '../../app/session';
import { PageHeading, ErrorBox, Empty, Loading, Modal, Pagination } from '../../components/ui';
type ProductList = { items: ProductDto[]; total: number; page: number; pageSize: number };
export function ProductsPage() {
  const { user } = useSession(),
    queryClient = useQueryClient(),
    [params, setParams] = useSearchParams(),
    [editor, setEditor] = useState<ProductDto | 'new' | null>(params.get('nuevo') ? 'new' : null),
    [imageProduct, setImageProduct] = useState<ProductDto | null>(null),
    [search, setSearch] = useState(''),
    [category, setCategory] = useState(''),
    [archived, setArchived] = useState(false),
    [page, setPage] = useState(1),
    [actionError, setActionError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ['products', user?.tenant.id, search, category, archived, page],
    queryFn: () =>
      api<ProductList>(
        `/products?search=${encodeURIComponent(search)}&page=${page}&archived=${archived}${category ? `&categoryId=${category}` : ''}`,
      ),
  });
  const categories = useQuery({
    queryKey: ['categories', user?.tenant.id],
    queryFn: () => api<CategoryDto[]>('/categories'),
  });
  const writable = user && can(user.role, 'catalog:write');
  function close() {
    setEditor(null);
    setParams({});
  }
  async function refresh() {
    await queryClient.invalidateQueries();
  }
  async function status(product: ProductDto) {
    setActionError(null);
    setBusy(true);
    try {
      await api(
        `/products/${product.id}/status`,
        json('PATCH', { active: !product.active, version: product.version }),
      );
      await refresh();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="UN CATÁLOGO CON POSIBILIDADES"
        title="Tus productos"
        description="Cada referencia, precio y variante en un solo lugar."
        action={
          writable && (
            <button className="button primary" onClick={() => setEditor('new')}>
              <Plus size={18} />
              Nuevo producto
            </button>
          )
        }
      />
      <ErrorBox error={actionError || categories.error} />
      <section className="panel">
        <div className="toolbar">
          <div className="search-field">
            <Search size={18} />
            <input
              aria-label="Buscar productos"
              placeholder="Buscar por nombre o SKU…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            aria-label="Filtrar por categoría"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas las categorías</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Estado de productos"
            value={archived ? 'archived' : 'active'}
            onChange={(e) => {
              setArchived(e.target.value === 'archived');
              setPage(1);
            }}
          >
            <option value="active">Activos</option>
            <option value="archived">Archivados</option>
          </select>
        </div>
        <ErrorBox error={query.error} />
        {query.isPending ? (
          <Loading />
        ) : query.data?.items.length ? (
          <>
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Tabla con desplazamiento horizontal"
            >
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Precio</th>
                    <th>Existencias</th>
                    <th>Estado</th>
                    {writable && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <div className="product-cell">
                          <span className="product-thumb">
                            {product.imageId ? (
                              <img src={`/api/v1/images/${product.imageId}`} alt="" />
                            ) : (
                              <Package size={21} />
                            )}
                          </span>
                          <div>
                            <strong>{product.name}</strong>
                            <small>
                              {product.variants.length === 1
                                ? product.variants[0]?.sku
                                : `${product.variants.length} variantes`}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>{product.category?.name ?? 'Sin categoría'}</td>
                      <td>
                        {product.variants.length > 1 && <small>Desde</small>}
                        {money(Math.min(...product.variants.map((v) => Number(v.price))))}
                      </td>
                      <td>
                        <strong>
                          {product.variants.reduce((sum, v) => sum + (v.balance?.onHand ?? 0), 0)}
                        </strong>
                        <small>unidades</small>
                      </td>
                      <td>
                        <span className={`badge ${product.active ? 'success' : 'neutral'}`}>
                          {product.active ? 'Activo' : 'Archivado'}
                        </span>
                      </td>
                      {writable && (
                        <td>
                          <div className="row-actions">
                            {product.active && (
                              <>
                                <button
                                  className="icon-button"
                                  aria-label={`Editar ${product.name}`}
                                  onClick={() => setEditor(product)}
                                >
                                  <Pencil size={17} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label={`Imagen de ${product.name}`}
                                  onClick={() => setImageProduct(product)}
                                >
                                  <ImagePlus size={17} />
                                </button>
                              </>
                            )}
                            <button
                              className="icon-button"
                              disabled={busy}
                              aria-label={`${product.active ? 'Archivar' : 'Restaurar'} ${product.name}`}
                              onClick={() => void status(product)}
                            >
                              {product.active ? <Archive size={17} /> : <RotateCcw size={17} />}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={query.data.total} pageSize={20} onChange={setPage} />
          </>
        ) : (
          !query.error && (
            <Empty
              title={search ? 'No encontramos coincidencias' : 'Tu catálogo empieza aquí'}
              description={
                search
                  ? 'Prueba otro nombre, SKU o categoría.'
                  : 'Agrega tu primer producto. Después podrás registrar sus existencias.'
              }
              action={
                writable &&
                !archived && (
                  <button className="button primary" onClick={() => setEditor('new')}>
                    <Plus size={17} />
                    Crear producto
                  </button>
                )
              }
            />
          )
        )}
      </section>
      {editor && (
        <ProductEditor
          product={editor === 'new' ? null : editor}
          categories={categories.data ?? []}
          onClose={close}
          onSaved={refresh}
        />
      )}
      {imageProduct && (
        <ImageEditor
          product={imageProduct}
          onClose={() => setImageProduct(null)}
          onSaved={refresh}
        />
      )}
    </>
  );
}
function ProductEditor({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: ProductDto | null;
  categories: CategoryDto[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<ProductInput>({
      name: product?.name ?? '',
      description: product?.description ?? '',
      categoryId: product?.category?.id ?? null,
      variants: product?.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        name: v.name,
        price: v.price,
        lowStockThreshold: v.lowStockThreshold,
      })) ?? [{ sku: '', name: 'Principal', price: '0', lowStockThreshold: 5 }],
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  function variant(index: number, key: string, value: string | number) {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, i) => (i === index ? { ...v, [key]: value } : v)),
    }));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const input = productSchema.parse(form);
      await api(
        product ? `/products/${product.id}` : '/products',
        json(product ? 'PUT' : 'POST', product ? { ...input, version: product.version } : input),
      );
      await onSaved();
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={product ? 'Editar producto' : 'Un nuevo producto'}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit} className="modal-body">
        <ErrorBox error={error} />
        <div className="form-grid">
          <label>
            Nombre del producto
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              minLength={2}
              maxLength={150}
              required
              placeholder="Ej. Camisa de lino"
            />
          </label>
          <label>
            Categoría
            <select
              value={form.categoryId ?? ''}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value || null })}
            >
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Descripción
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            maxLength={2000}
            rows={3}
            placeholder="Los detalles que hacen especial a tu producto"
          />
        </label>
        <div className="section-label">
          <h3>Variantes y referencias</h3>
          <span>{form.variants.length} / 30</span>
        </div>
        {form.variants.map((v, index) => (
          <div className="variant-form" key={v.id ?? index}>
            <div className="form-grid">
              <label>
                Variante
                <input
                  aria-label={`Nombre variante ${index + 1}`}
                  value={v.name}
                  onChange={(e) => variant(index, 'name', e.target.value)}
                  required
                  maxLength={100}
                />
              </label>
              <label>
                SKU
                <input
                  value={v.sku}
                  onChange={(e) => variant(index, 'sku', e.target.value)}
                  required
                  maxLength={64}
                  placeholder="CAM-LIN-M"
                />
              </label>
              <label>
                Precio (COP)
                <input
                  value={v.price}
                  onChange={(e) => variant(index, 'price', e.target.value)}
                  inputMode="decimal"
                  pattern="[0-9]+([.][0-9]{1,2})?"
                  required
                />
              </label>
              <label>
                Alerta de stock mínimo
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  value={v.lowStockThreshold}
                  onChange={(e) => variant(index, 'lowStockThreshold', Number(e.target.value))}
                  required
                />
              </label>
            </div>
            {!v.id && form.variants.length > 1 && (
              <button
                type="button"
                className="text-link danger-text"
                onClick={() =>
                  setForm({ ...form, variants: form.variants.filter((_, i) => i !== index) })
                }
              >
                <X size={15} />
                Quitar variante
              </button>
            )}
          </div>
        ))}
        {form.variants.length < 30 && (
          <button
            type="button"
            className="button secondary"
            onClick={() =>
              setForm({
                ...form,
                variants: [
                  ...form.variants,
                  { sku: '', name: '', price: '0', lowStockThreshold: 5 },
                ],
              })
            }
          >
            <Plus size={16} />
            Agregar variante
          </button>
        )}
        <p className="form-help">
          Las existencias se registran desde Inventario para conservar el historial. Las variantes
          existentes se conservan por trazabilidad.
        </p>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar producto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ImageEditor({
  product,
  onClose,
  onSaved,
}: {
  product: ProductDto;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const data = new FormData();
      data.set('image', file);
      await api(`/products/${product.id}/image`, { method: 'POST', body: data });
      await onSaved();
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`Imagen · ${product.name}`}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form className="modal-body" onSubmit={submit}>
        <ErrorBox error={error} />
        <label>
          Imagen del producto
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
        </label>
        <p className="form-help">
          PNG, JPEG o WebP. Máximo 5 MB y 16 megapíxeles. El archivo se almacena de forma privada
          para tu comercio.
        </p>
        <div className="modal-actions">
          <button className="button primary" disabled={busy || !file}>
            {busy ? 'Subiendo…' : 'Guardar imagen'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
