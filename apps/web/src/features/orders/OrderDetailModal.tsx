import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { OrderDto, OrderStatus } from '@nexora/shared';
import { can, cancelOrderSchema, channelLabels, orderStatusLabels } from '@nexora/shared';
import { api, dateTime, json, money } from '../../lib/api';
import { useSession } from '../../app/session';
import { ErrorBox, Loading, Modal } from '../../components/ui';

export const statusTone: Record<OrderStatus, string> = {
  DRAFT: 'neutral',
  CONFIRMED: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};
export function OrderDetailModal({
  id,
  onClose,
  onEdit,
}: {
  id: string;
  onClose: () => void;
  onEdit: (order: OrderDto) => void;
}) {
  const { user } = useSession(),
    qc = useQueryClient(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [cancelling, setCancelling] = useState(false),
    [reason, setReason] = useState('');
  const query = useQuery({
    queryKey: ['order', user?.tenant.id, id],
    queryFn: () => api<OrderDto>(`/orders/${id}`),
  });
  const order = query.data;
  const writable = user ? can(user.role, 'orders:write') : false;
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await qc.invalidateQueries();
      setCancelling(false);
      setReason('');
    } catch (e) {
      setError(e);
      await query.refetch();
    } finally {
      setBusy(false);
    }
  }
  const transition = (name: 'confirm' | 'complete') =>
    run(() => api(`/orders/${id}/${name}`, json('POST', { version: order?.version })));
  return (
    <Modal
      title={order ? `Pedido #${order.number}` : 'Pedido'}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="modal-body">
        <ErrorBox error={error || query.error} />
        {query.isPending ? (
          <Loading />
        ) : (
          order && (
            <>
              <div className="order-meta">
                <span className={`badge ${statusTone[order.status]}`}>
                  {orderStatusLabels[order.status]}
                </span>
                <span className="badge neutral">{channelLabels[order.channel]}</span>
                <span className="muted">{dateTime(order.createdAt)}</span>
              </div>
              <div className="form-grid">
                <div>
                  <p className="section-title">Cliente</p>
                  <p>{order.customerName || 'Sin cliente'}</p>
                  {order.customerPhone && <small className="muted">{order.customerPhone}</small>}
                </div>
                <div>
                  <p className="section-title">Registrado por</p>
                  <p>{order.createdByName}</p>
                </div>
              </div>
              {order.deliveryAddress && (
                <div>
                  <p className="section-title">Dirección de entrega</p>
                  <p>{order.deliveryAddress}</p>
                </div>
              )}
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Productos del pedido"
              >
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cant.</th>
                      <th>Precio</th>
                      <th>Descuento</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.lines.map((line) => (
                      <tr key={line.id}>
                        <td>
                          <strong>{line.productName}</strong>
                          <small>
                            {line.variantName} · {line.sku}
                          </small>
                        </td>
                        <td>{line.quantity}</td>
                        <td>{money(line.unitPrice)}</td>
                        <td>{money(Number(line.discount) + Number(line.orderDiscountShare))}</td>
                        <td>{money(line.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <dl className="totals">
                <div>
                  <dt>Subtotal</dt>
                  <dd>{money(order.subtotal)}</dd>
                </div>
                <div>
                  <dt>Descuentos</dt>
                  <dd>−{money(order.discountTotal)}</dd>
                </div>
                {Number(order.deliveryFee) > 0 && (
                  <div>
                    <dt>Domicilio</dt>
                    <dd>{money(order.deliveryFee)}</dd>
                  </div>
                )}
                <div className="totals-grand">
                  <dt>Total</dt>
                  <dd>{money(order.total)}</dd>
                </div>
              </dl>
              {order.notes && (
                <div>
                  <p className="section-title">Notas</p>
                  <p>{order.notes}</p>
                </div>
              )}
              <div>
                <p className="section-title">Historial</p>
                <ol className="timeline">
                  {order.events.map((event) => (
                    <li key={event.id}>
                      <strong>{orderStatusLabels[event.toStatus]}</strong>
                      <small>
                        {dateTime(event.createdAt)} · {event.actorName}
                      </small>
                      {event.reason && <small>{event.reason}</small>}
                    </li>
                  ))}
                </ol>
              </div>
              {cancelling && (
                <label>
                  Motivo de la cancelación
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    minLength={5}
                    maxLength={500}
                    rows={2}
                  />
                </label>
              )}
              {writable && (order.status === 'DRAFT' || order.status === 'CONFIRMED') && (
                <div className="modal-actions">
                  {cancelling ? (
                    <>
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() => setCancelling(false)}
                      >
                        Volver
                      </button>
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            api(
                              `/orders/${id}/cancel`,
                              json(
                                'POST',
                                cancelOrderSchema.parse({ version: order.version, reason }),
                              ),
                            ),
                          )
                        }
                      >
                        Confirmar cancelación
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="button secondary danger-text"
                        disabled={busy}
                        onClick={() => setCancelling(true)}
                      >
                        Cancelar pedido
                      </button>
                      {order.status === 'DRAFT' && (
                        <>
                          <button
                            className="button secondary"
                            disabled={busy}
                            onClick={() => onEdit(order)}
                          >
                            Editar
                          </button>
                          <button
                            className="button primary"
                            disabled={busy}
                            onClick={() => void transition('confirm')}
                          >
                            Confirmar pedido
                          </button>
                        </>
                      )}
                      {order.status === 'CONFIRMED' && (
                        <button
                          className="button primary"
                          disabled={busy}
                          onClick={() => void transition('complete')}
                        >
                          Completar pedido
                        </button>
                      )}
                    </>
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
