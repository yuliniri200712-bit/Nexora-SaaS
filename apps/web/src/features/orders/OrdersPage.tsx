import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, Plus, Search } from 'lucide-react';
import type { OrderDto, OrderStatus, OrderSummaryDto } from '@nexora/shared';
import { can, channelLabels, orderStatusLabels } from '@nexora/shared';
import { api, dateTime, money } from '../../lib/api';
import { useSession } from '../../app/session';
import { Empty, ErrorBox, Loading, PageHeading, Pagination } from '../../components/ui';
import { OrderDetailModal, statusTone } from './OrderDetailModal';
import { OrderFormModal } from './OrderFormModal';

const statuses = Object.keys(orderStatusLabels) as OrderStatus[];
export function OrdersPage({ mode }: { mode: 'sales' | 'orders' }) {
  const { user } = useSession(),
    [page, setPage] = useState(1),
    [status, setStatus] = useState(''),
    [channel, setChannel] = useState(''),
    [search, setSearch] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [creating, setCreating] = useState(false),
    [editing, setEditing] = useState<OrderDto | null>(null),
    [detail, setDetail] = useState<string | null>(null);
  const sales = mode === 'sales';
  const dated = Boolean(from && to);
  const params = new URLSearchParams({
    page: String(page),
    search,
    ...(sales ? { status: 'COMPLETED' } : status ? { status } : {}),
    ...(channel ? { channel } : {}),
    ...(dated ? { from, to } : {}),
  });
  const query = useQuery({
    queryKey: ['orders', user?.tenant.id, params.toString()],
    queryFn: () =>
      api<{ items: OrderSummaryDto[]; total: number; pageSize: number }>(`/orders?${params}`),
  });
  const writable = user ? can(user.role, 'orders:write') : false;
  const filtering = Boolean(search || status || channel || dated);
  const resetting =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };
  return (
    <>
      <PageHeading
        eyebrow={sales ? 'CADA VENTA CUENTA' : 'DEL PEDIDO A LA ENTREGA'}
        title={sales ? 'Ventas' : 'Pedidos'}
        description={
          sales
            ? 'Todo lo que has vendido, con su detalle y responsable.'
            : 'Confirma, reserva existencias y completa cada pedido con trazabilidad.'
        }
        action={
          writable && (
            <button className="button primary" onClick={() => setCreating(true)}>
              <Plus size={18} />
              {sales ? 'Nueva venta' : 'Nuevo pedido'}
            </button>
          )
        }
      />
      <section className="panel">
        <div className="toolbar report-toolbar">
          <div className="search-field">
            <Search size={18} />
            <input
              aria-label="Buscar por número o cliente"
              placeholder="Número o cliente…"
              value={search}
              onChange={(e) => resetting(setSearch)(e.target.value)}
            />
          </div>
          {!sales && (
            <select
              aria-label="Filtrar por estado"
              value={status}
              onChange={(e) => resetting(setStatus)(e.target.value)}
            >
              <option value="">Todos los estados</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {orderStatusLabels[value]}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Filtrar por canal"
            value={channel}
            onChange={(e) => resetting(setChannel)(e.target.value)}
          >
            <option value="">Todos los canales</option>
            <option value="COUNTER">{channelLabels.COUNTER}</option>
            <option value="DELIVERY">{channelLabels.DELIVERY}</option>
          </select>
          <label>
            Desde
            <input type="date" value={from} onChange={(e) => resetting(setFrom)(e.target.value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={to} onChange={(e) => resetting(setTo)(e.target.value)} />
          </label>
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
                    <th>Número</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Canal</th>
                    <th>Productos</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <strong>#{order.number}</strong>
                      </td>
                      <td>{dateTime(order.completedAt ?? order.createdAt)}</td>
                      <td>
                        {order.customerName || 'Sin cliente'}
                        <small>{order.createdByName}</small>
                      </td>
                      <td>{channelLabels[order.channel]}</td>
                      <td>{order.itemCount}</td>
                      <td>
                        <strong>{money(order.total)}</strong>
                      </td>
                      <td>
                        <span className={`badge ${statusTone[order.status]}`}>
                          {orderStatusLabels[order.status]}
                        </span>
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`Ver pedido ${order.number}`}
                          onClick={() => setDetail(order.id)}
                        >
                          <Eye size={18} />
                        </button>
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
            title={
              filtering
                ? 'No encontramos coincidencias'
                : sales
                  ? 'Tu primera venta te espera'
                  : 'Todavía no hay pedidos'
            }
            description={
              filtering
                ? 'Prueba con otros filtros o un periodo distinto.'
                : sales
                  ? 'Registra una venta y aquí verás su detalle.'
                  : 'Crea un pedido para reservar existencias y darle seguimiento.'
            }
          />
        )}
      </section>
      {creating && (
        <OrderFormModal mode={sales ? 'sale' : 'order'} onClose={() => setCreating(false)} />
      )}
      {editing && <OrderFormModal mode="order" draft={editing} onClose={() => setEditing(null)} />}
      {detail && !editing && (
        <OrderDetailModal id={detail} onClose={() => setDetail(null)} onEdit={setEditing} />
      )}
    </>
  );
}
