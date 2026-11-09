import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { CustomerDetailDto, CustomerDto, OrderSummaryDto } from '@nexora/shared';
import { addressSchema, can, customerSchema, orderStatusLabels } from '@nexora/shared';
import { api, dateTime, json, money } from '../../lib/api';
import { useSession } from '../../app/session';
import { Empty, ErrorBox, Loading, Modal, PageHeading, Pagination } from '../../components/ui';
import { statusTone } from '../orders/OrderDetailModal';

export function CustomersPage() {
  const { user } = useSession(),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [form, setForm] = useState<CustomerDto | 'new' | null>(null),
    [detail, setDetail] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['customers', user?.tenant.id, search, page],
    queryFn: () =>
      api<{ items: CustomerDto[]; total: number; pageSize: number }>(
        `/customers?search=${encodeURIComponent(search)}&page=${page}`,
      ),
  });
  const writable = user ? can(user.role, 'customers:write') : false;
  return (
    <>
      <PageHeading
        eyebrow="LAS PERSONAS DETRÁS DE CADA VENTA"
        title="Clientes"
        description="Sus datos, direcciones e historial de compras en un solo lugar."
        action={
          writable && (
            <button className="button primary" onClick={() => setForm('new')}>
              <Plus size={18} />
              Nuevo cliente
            </button>
          )
        }
      />
      <section className="panel">
        <div className="toolbar">
          <div className="search-field">
            <Search size={18} />
            <input
              aria-label="Buscar clientes"
              placeholder="Nombre o teléfono…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
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
                    <th>Cliente</th>
                    <th>Teléfono</th>
                    <th>Correo</th>
                    <th>Pedidos</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <strong>{customer.name}</strong>
                      </td>
                      <td>{customer.phone ?? '—'}</td>
                      <td>{customer.email ?? '—'}</td>
                      <td>{customer.orderCount}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            aria-label={`Ver ${customer.name}`}
                            onClick={() => setDetail(customer.id)}
                          >
                            <Eye size={18} />
                          </button>
                          {writable && (
                            <button
                              className="icon-button"
                              aria-label={`Editar ${customer.name}`}
                              onClick={() => setForm(customer)}
                            >
                              <Pencil size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              total={query.data.total}
              pageSize={query.data.pageSize}
              onChange={setPage}
            />
          </>
        ) : (
          <Empty
            title={search ? 'No encontramos coincidencias' : 'Tu lista de clientes empieza aquí'}
            description={
              search
                ? 'Prueba con otro nombre o teléfono.'
                : 'Registra a tus clientes para llevar su historial de compras.'
            }
          />
        )}
      </section>
      {form && (
        <CustomerFormModal customer={form === 'new' ? null : form} onClose={() => setForm(null)} />
      )}
      {detail && <CustomerDetailModal id={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

function CustomerFormModal({
  customer,
  onClose,
}: {
  customer: CustomerDto | null;
  onClose: () => void;
}) {
  const qc = useQueryClient(),
    [name, setName] = useState(customer?.name ?? ''),
    [phone, setPhone] = useState(customer?.phone ?? ''),
    [email, setEmail] = useState(customer?.email ?? ''),
    [notes, setNotes] = useState(customer?.notes ?? ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = customerSchema.parse({
        name,
        phone: phone.trim() || null,
        email: email.trim() || null,
        notes,
      });
      if (customer)
        await api(`/customers/${customer.id}`, json('PUT', { version: customer.version, data }));
      else await api('/customers', json('POST', data));
      await qc.invalidateQueries();
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={customer ? 'Editar cliente' : 'Nuevo cliente'} onClose={onClose}>
      <form className="modal-body" onSubmit={submit}>
        <ErrorBox error={error} />
        <label>
          Nombre del cliente
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={120}
          />
        </label>
        <div className="form-grid">
          <label>
            Teléfono
            <input
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="3001234567"
            />
          </label>
          <label>
            Correo
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        </div>
        <label>
          Notas
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            rows={2}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar cliente'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const emptyAddress = { label: '', line: '', city: '', notes: '' };
function CustomerDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { user } = useSession(),
    qc = useQueryClient(),
    [address, setAddress] = useState(emptyAddress),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const writable = user ? can(user.role, 'customers:write') : false;
  const canSeeOrders = user ? can(user.role, 'orders:read') : false;
  const customer = useQuery({
    queryKey: ['customer', user?.tenant.id, id],
    queryFn: () => api<CustomerDetailDto>(`/customers/${id}`),
  });
  const history = useQuery({
    queryKey: ['customer-orders', user?.tenant.id, id],
    queryFn: () => api<{ items: OrderSummaryDto[] }>(`/orders?customerId=${id}`),
    enabled: canSeeOrders,
  });
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await qc.invalidateQueries();
      setAddress(emptyAddress);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const data = customer.data;
  return (
    <Modal title={data?.name ?? 'Cliente'} onClose={onClose}>
      <div className="modal-body">
        <ErrorBox error={error || customer.error || history.error} />
        {customer.isPending ? (
          <Loading />
        ) : (
          data && (
            <>
              <div className="form-grid">
                <div>
                  <p className="section-title">Compras completadas</p>
                  <p>{data.completedOrders}</p>
                </div>
                <div>
                  <p className="section-title">Total comprado</p>
                  <p>{money(data.totalSpent)}</p>
                </div>
              </div>
              {data.notes && (
                <div>
                  <p className="section-title">Notas</p>
                  <p>{data.notes}</p>
                </div>
              )}
              <div>
                <p className="section-title">Direcciones</p>
                {data.addresses.length ? (
                  <ul className="address-list">
                    {data.addresses.map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>{item.label}</strong>
                          <small>
                            {item.line}, {item.city}
                            {item.notes ? ` · ${item.notes}` : ''}
                          </small>
                        </div>
                        {writable && (
                          <button
                            className="icon-button"
                            aria-label={`Eliminar dirección ${item.label}`}
                            disabled={busy}
                            onClick={() =>
                              void run(() =>
                                api(`/customers/${id}/addresses/${item.id}`, json('DELETE')),
                              )
                            }
                          >
                            <Trash2 size={17} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="form-help">Sin direcciones registradas.</p>
                )}
              </div>
              {writable && (
                <form
                  className="variant-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(() =>
                      api(`/customers/${id}/addresses`, json('POST', addressSchema.parse(address))),
                    );
                  }}
                >
                  <div className="form-grid">
                    <label>
                      Nombre de la dirección
                      <input
                        value={address.label}
                        onChange={(e) => setAddress({ ...address, label: e.target.value })}
                        placeholder="Casa, oficina…"
                        required
                      />
                    </label>
                    <label>
                      Ciudad
                      <input
                        value={address.city}
                        onChange={(e) => setAddress({ ...address, city: e.target.value })}
                        required
                      />
                    </label>
                  </div>
                  <label className="spaced-field">
                    Dirección
                    <input
                      value={address.line}
                      onChange={(e) => setAddress({ ...address, line: e.target.value })}
                      required
                    />
                  </label>
                  <button className="button secondary small spaced-field" disabled={busy}>
                    Agregar dirección
                  </button>
                </form>
              )}
              {canSeeOrders && (
                <div>
                  <p className="section-title">Historial de compras</p>
                  {history.data?.items.length ? (
                    <div
                      className="table-scroll"
                      tabIndex={0}
                      role="region"
                      aria-label="Historial de compras"
                    >
                      <table>
                        <thead>
                          <tr>
                            <th>Número</th>
                            <th>Fecha</th>
                            <th>Total</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.data.items.map((order) => (
                            <tr key={order.id}>
                              <td>#{order.number}</td>
                              <td>{dateTime(order.createdAt)}</td>
                              <td>{money(order.total)}</td>
                              <td>
                                <span className={`badge ${statusTone[order.status]}`}>
                                  {orderStatusLabels[order.status]}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="form-help">Este cliente aún no tiene compras.</p>
                  )}
                </div>
              )}
            </>
          )
        )}
      </div>
    </Modal>
  );
}
