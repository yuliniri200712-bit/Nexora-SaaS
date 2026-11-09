import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Package } from 'lucide-react';
import type { ProductDto, MovementDto } from '@nexora/shared';
import { can, movementSchema, movementTypeLabels } from '@nexora/shared';
import { api, json, dateTime } from '../../lib/api';
import { useSession } from '../../app/session';
import { PageHeading, ErrorBox, Empty, Loading, Modal, Pagination } from '../../components/ui';
export function InventoryPage() {
  const { user } = useSession(),
    [tab, setTab] = useState('stock'),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [modal, setModal] = useState(false);
  const products = useQuery({
    queryKey: ['stock', user?.tenant.id, search, page],
    queryFn: () =>
      api<{ items: ProductDto[]; total: number }>(
        `/products?search=${encodeURIComponent(search)}&page=${page}`,
      ),
    enabled: tab === 'stock',
  });
  const moves = useQuery({
    queryKey: ['movements', user?.tenant.id, page],
    queryFn: () =>
      api<{ items: MovementDto[]; total: number }>(`/inventory/movements?page=${page}`),
    enabled: tab === 'history',
  });
  return (
    <>
      <PageHeading
        eyebrow="CADA UNIDAD, BAJO CONTROL"
        title="Tu inventario"
        description="Entradas, salidas y ajustes con un historial que siempre te acompaña."
        action={
          user &&
          can(user.role, 'inventory:write') && (
            <button className="button primary" onClick={() => setModal(true)}>
              <Plus size={18} />
              Registrar movimiento
            </button>
          )
        }
      />
      <section className="panel">
        <div className="toolbar">
          <div className="tabs" role="group" aria-label="Vista de inventario">
            <button
              className={tab === 'stock' ? 'active' : ''}
              onClick={() => {
                setTab('stock');
                setPage(1);
              }}
            >
              Existencias
            </button>
            <button
              className={tab === 'history' ? 'active' : ''}
              onClick={() => {
                setTab('history');
                setPage(1);
              }}
            >
              Movimientos
            </button>
          </div>
          {tab === 'stock' && (
            <div className="search-field">
              <Search size={18} />
              <input
                aria-label="Buscar inventario"
                placeholder="Buscar producto o SKU…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          )}
        </div>
        <ErrorBox error={tab === 'stock' ? products.error : moves.error} />
        {(tab === 'stock' ? products.isPending : moves.isPending) ? (
          <Loading />
        ) : tab === 'stock' ? (
          products.data?.items.length ? (
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
                      <th>Producto / variante</th>
                      <th>SKU</th>
                      <th>Existencias</th>
                      <th>Disponible</th>
                      <th>Stock mínimo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.data.items.flatMap((p) =>
                      p.variants.map((v) => {
                        const stock = v.balance?.onHand ?? 0,
                          available = stock - (v.balance?.reserved ?? 0);
                        return (
                          <tr key={v.id}>
                            <td>
                              <div className="product-cell">
                                <span className="product-thumb">
                                  <Package size={18} />
                                </span>
                                <div>
                                  <strong>{p.name}</strong>
                                  <small>{v.name}</small>
                                </div>
                              </div>
                            </td>
                            <td>
                              <code>{v.sku}</code>
                            </td>
                            <td>{stock}</td>
                            <td>
                              <strong>{available}</strong>
                            </td>
                            <td>{v.lowStockThreshold}</td>
                            <td>
                              <span
                                className={`badge ${available === 0 ? 'danger' : available <= v.lowStockThreshold ? 'warning' : 'success'}`}
                              >
                                {available === 0
                                  ? 'Agotado'
                                  : available <= v.lowStockThreshold
                                    ? 'Stock bajo'
                                    : 'En equilibrio'}
                              </span>
                            </td>
                          </tr>
                        );
                      }),
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                total={products.data.total}
                pageSize={20}
                onChange={setPage}
              />
            </>
          ) : (
            <Empty
              title="Todavía no hay existencias"
              description="Crea un producto y registra su primera entrada para comenzar."
            />
          )
        ) : moves.data?.items.length ? (
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
                    <th>Fecha</th>
                    <th>Producto</th>
                    <th>Tipo</th>
                    <th>Cambio</th>
                    <th>Antes → después</th>
                    <th>Motivo / responsable</th>
                  </tr>
                </thead>
                <tbody>
                  {moves.data.items.map((m) => (
                    <tr key={m.id}>
                      <td>{dateTime(m.createdAt)}</td>
                      <td>
                        <strong>{m.variant.product.name}</strong>
                        <small>{m.variant.sku}</small>
                      </td>
                      <td>
                        <span className="badge neutral">
                          {movementTypeLabels[m.type] ?? m.type}
                        </span>
                      </td>
                      {m.quantity === 0 ? (
                        <td>
                          {m.reservedDelta > 0 ? '+' : ''}
                          {m.reservedDelta}
                          <small>reservadas</small>
                        </td>
                      ) : (
                        <td className={m.quantity > 0 ? 'positive' : 'negative'}>
                          {m.quantity > 0 ? '+' : ''}
                          {m.quantity}
                        </td>
                      )}
                      <td>
                        {m.before} → {m.after}
                      </td>
                      <td>
                        {m.reason}
                        <small>{m.actor.user.name}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={moves.data.total} pageSize={25} onChange={setPage} />
          </>
        ) : (
          <Empty
            title="Un historial claro desde el primer día"
            description="Los movimientos mostrarán qué cambió, cuándo y quién lo realizó."
          />
        )}
      </section>
      {modal && <MovementModal onClose={() => setModal(false)} />}
    </>
  );
}
function MovementModal({ onClose }: { onClose: () => void }) {
  const { user } = useSession(),
    qc = useQueryClient(),
    [search, setSearch] = useState(''),
    [variantId, setVariant] = useState(''),
    [type, setType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN'),
    [quantity, setQuantity] = useState(''),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    key = useRef(crypto.randomUUID());
  const query = useQuery({
    queryKey: ['movement-products', user?.tenant.id, search],
    queryFn: () => api<{ items: ProductDto[] }>(`/products?search=${encodeURIComponent(search)}`),
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const input = movementSchema.parse({ variantId, type, quantity: Number(quantity), reason });
      await api('/inventory/movements', {
        ...json('POST', input),
        headers: { 'Idempotency-Key': key.current },
      });
      await qc.invalidateQueries();
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Registrar movimiento"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="modal-body"
        onSubmit={submit}
        onChange={() => {
          key.current = crypto.randomUUID();
        }}
      >
        <ErrorBox error={error || query.error} />
        <label>
          Buscar producto
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVariant('');
            }}
            placeholder="Nombre o SKU"
          />
        </label>
        <label>
          Producto y variante
          <select value={variantId} onChange={(e) => setVariant(e.target.value)} required>
            <option value="">Selecciona una referencia</option>
            {query.data?.items.flatMap((p) =>
              p.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {p.name} · {v.name} · {v.sku} ({v.balance?.onHand ?? 0} uds.)
                </option>
              )),
            )}
          </select>
        </label>
        <div className="form-grid">
          <label>
            Tipo de movimiento
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="IN">Entrada</option>
              <option value="OUT">Salida</option>
              <option value="ADJUSTMENT">Ajuste (+ / −)</option>
            </select>
          </label>
          <label>
            Cantidad{type === 'ADJUSTMENT' ? ' a sumar o restar' : ''}
            <input
              type="number"
              min={type === 'ADJUSTMENT' ? -1000000 : 1}
              max={1000000}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </label>
        </div>
        <label>
          Motivo
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={5}
            maxLength={500}
            rows={3}
            placeholder="Ej. Recepción de mercancía del proveedor"
          />
        </label>
        <p className="form-help">
          El cambio quedará registrado con tu nombre y no se podrá eliminar. Para corregirlo,
          registra un nuevo ajuste.
        </p>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? 'Registrando…' : 'Confirmar movimiento'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
