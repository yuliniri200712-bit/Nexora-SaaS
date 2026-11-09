import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import type {
  CustomerDetailDto,
  CustomerDto,
  OrderChannel,
  OrderDto,
  ProductDto,
} from '@nexora/shared';
import { calculateTotals, orderSchema, saleSchema, TotalsError } from '@nexora/shared';
import { api, json, money } from '../../lib/api';
import { useSession } from '../../app/session';
import { ErrorBox, Modal } from '../../components/ui';

interface FormLine {
  variantId: string;
  label: string;
  unitPrice: string;
  available: number | null;
  quantity: string;
  discount: string;
}
const MONEY = /^\d{1,12}(\.\d{1,2})?$/;
const amount = (value: string) => value.trim().replace(',', '.') || '0';
const validQuantity = (value: string) => /^\d{1,6}$/.test(value) && Number(value) >= 1;

export function OrderFormModal({
  mode,
  draft,
  onClose,
}: {
  mode: 'sale' | 'order';
  draft?: OrderDto;
  onClose: () => void;
}) {
  const { user } = useSession(),
    qc = useQueryClient(),
    [productSearch, setProductSearch] = useState(''),
    [customerSearch, setCustomerSearch] = useState(''),
    [customerId, setCustomerId] = useState(draft?.customerId ?? ''),
    [addressId, setAddressId] = useState(''),
    [channel, setChannel] = useState<OrderChannel>(draft?.channel ?? 'COUNTER'),
    [lines, setLines] = useState<FormLine[]>(
      draft?.lines.map((line) => ({
        variantId: line.variantId,
        label: `${line.productName} · ${line.variantName} · ${line.sku}`,
        unitPrice: line.unitPrice,
        available: null,
        quantity: String(line.quantity),
        discount: Number(line.discount) ? line.discount : '',
      })) ?? [],
    ),
    [discount, setDiscount] = useState(
      draft && Number(draft.orderDiscount) ? draft.orderDiscount : '',
    ),
    [deliveryFee, setDeliveryFee] = useState(
      draft && Number(draft.deliveryFee) ? draft.deliveryFee : '',
    ),
    [notes, setNotes] = useState(draft?.notes ?? ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    attempt = useRef({ payload: '', key: crypto.randomUUID() });
  const delivery = mode === 'order' && channel === 'DELIVERY';
  const products = useQuery({
    queryKey: ['order-products', user?.tenant.id, productSearch],
    queryFn: () =>
      api<{ items: ProductDto[] }>(`/products?search=${encodeURIComponent(productSearch)}`),
  });
  const customers = useQuery({
    queryKey: ['order-customers', user?.tenant.id, customerSearch],
    queryFn: () =>
      api<{ items: CustomerDto[] }>(`/customers?search=${encodeURIComponent(customerSearch)}`),
  });
  const customer = useQuery({
    queryKey: ['customer', user?.tenant.id, customerId],
    queryFn: () => api<CustomerDetailDto>(`/customers/${customerId}`),
    enabled: delivery && Boolean(customerId),
  });
  const preview = useMemo(() => {
    const ready =
      lines.length > 0 &&
      lines.every((l) => validQuantity(l.quantity) && MONEY.test(amount(l.discount))) &&
      MONEY.test(amount(discount)) &&
      MONEY.test(amount(deliveryFee));
    if (!ready) return null;
    try {
      return calculateTotals(
        lines.map((l) => ({
          variantId: l.variantId,
          unitPrice: l.unitPrice,
          quantity: Number(l.quantity),
          discount: amount(l.discount),
        })),
        amount(discount),
        delivery ? amount(deliveryFee) : '0',
      );
    } catch (e) {
      if (e instanceof TotalsError) return e;
      throw e;
    }
  }, [lines, discount, deliveryFee, delivery]);
  const options =
    products.data?.items.flatMap((product) =>
      product.variants
        .filter((variant) => !lines.some((line) => line.variantId === variant.id))
        .map((variant) => ({
          variant,
          product,
          available: (variant.balance?.onHand ?? 0) - (variant.balance?.reserved ?? 0),
        })),
    ) ?? [];
  function addLine(variantId: string) {
    const option = options.find((o) => o.variant.id === variantId);
    if (!option) return;
    setLines((current) => [
      ...current,
      {
        variantId,
        label: `${option.product.name} · ${option.variant.name} · ${option.variant.sku}`,
        unitPrice: option.variant.price,
        available: option.available,
        quantity: '1',
        discount: '',
      },
    ]);
  }
  const patchLine = (variantId: string, patch: Partial<FormLine>) =>
    setLines((current) => current.map((l) => (l.variantId === variantId ? { ...l, ...patch } : l)));
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const payloadLines = lines.map((l) => ({
        variantId: l.variantId,
        quantity: Number(l.quantity),
        discount: amount(l.discount),
      }));
      const common = {
        customerId: customerId || null,
        lines: payloadLines,
        discount: amount(discount),
        notes,
      };
      const body =
        mode === 'sale'
          ? saleSchema.parse(common)
          : orderSchema.parse({
              ...common,
              channel,
              addressId: delivery ? addressId || null : null,
              deliveryFee: delivery ? amount(deliveryFee) : '0',
            });
      const payload = JSON.stringify(body);
      if (attempt.current.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      if (draft)
        await api(`/orders/${draft.id}`, json('PUT', { version: draft.version, order: body }));
      else
        await api(mode === 'sale' ? '/sales' : '/orders', {
          ...json('POST', body),
          headers: { 'Idempotency-Key': attempt.current.key },
        });
      await qc.invalidateQueries();
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const draftCustomerMissing =
    draft?.customerId && !customers.data?.items.some((c) => c.id === draft.customerId);
  const title = draft
    ? `Editar pedido #${draft.number}`
    : mode === 'sale'
      ? 'Registrar venta'
      : 'Nuevo pedido';
  return (
    <Modal
      title={title}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form className="modal-body" onSubmit={submit}>
        <ErrorBox error={error || products.error || customers.error || customer.error} />
        <div className="form-grid">
          <label>
            Buscar cliente
            <input
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setCustomerId('');
                setAddressId('');
              }}
              placeholder="Nombre o teléfono"
            />
          </label>
          <label>
            Cliente
            <select
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setAddressId('');
              }}
            >
              <option value="">Sin cliente</option>
              {draftCustomerMissing && customerId === draft.customerId && (
                <option value={draft.customerId ?? ''}>{draft.customerName}</option>
              )}
              {customers.data?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.phone ? ` · ${c.phone}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        {mode === 'order' && (
          <label>
            Entrega
            <select value={channel} onChange={(e) => setChannel(e.target.value as OrderChannel)}>
              <option value="COUNTER">Recoge en mostrador</option>
              <option value="DELIVERY">Domicilio</option>
            </select>
          </label>
        )}
        {delivery && (
          <div className="form-grid">
            <label>
              Dirección de entrega
              <select value={addressId} onChange={(e) => setAddressId(e.target.value)} required>
                <option value="">
                  {customerId ? 'Selecciona una dirección' : 'Selecciona primero un cliente'}
                </option>
                {customer.data?.addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} · {a.line}, {a.city}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Costo de domicilio (COP)
              <input
                inputMode="decimal"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                placeholder="0"
              />
            </label>
          </div>
        )}
        {delivery && customer.data && customer.data.addresses.length === 0 && (
          <p className="form-help">Este cliente no tiene direcciones. Agrégala en Clientes.</p>
        )}
        <div className="form-grid">
          <label>
            Buscar producto
            <input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Nombre o SKU"
            />
          </label>
          <label>
            Agregar producto
            <select
              value=""
              onChange={(e) => {
                addLine(e.target.value);
                e.target.blur();
              }}
            >
              <option value="">Selecciona una referencia</option>
              {options.map(({ variant, product, available }) => (
                <option
                  key={variant.id}
                  value={variant.id}
                  disabled={mode === 'sale' && available <= 0}
                >
                  {product.name} · {variant.name} · {variant.sku} · {money(variant.price)} (
                  {available} disp.)
                </option>
              ))}
            </select>
          </label>
        </div>
        {lines.length > 0 ? (
          <ul className="order-lines" aria-label="Productos del pedido">
            {lines.map((line) => (
              <li key={line.variantId}>
                <div className="order-line-name">
                  <strong>{line.label}</strong>
                  <small>
                    {money(line.unitPrice)} c/u
                    {line.available !== null ? ` · ${line.available} disponibles` : ''}
                  </small>
                </div>
                <label>
                  Cantidad
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    value={line.quantity}
                    onChange={(e) => patchLine(line.variantId, { quantity: e.target.value })}
                    required
                  />
                </label>
                <label>
                  Descuento
                  <input
                    inputMode="decimal"
                    value={line.discount}
                    onChange={(e) => patchLine(line.variantId, { discount: e.target.value })}
                    placeholder="0"
                  />
                </label>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Quitar ${line.label}`}
                  onClick={() =>
                    setLines((current) => current.filter((l) => l.variantId !== line.variantId))
                  }
                >
                  <Trash2 size={17} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="form-help">Agrega al menos un producto para calcular el total.</p>
        )}
        <div className="form-grid">
          <label>
            Descuento general (COP)
            <input
              inputMode="decimal"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0"
            />
          </label>
          <label>
            Notas
            <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          </label>
        </div>
        {preview instanceof TotalsError && (
          <p className="danger-text" role="alert">
            {preview.message}
          </p>
        )}
        {preview && !(preview instanceof TotalsError) && (
          <dl className="totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{money(preview.subtotal)}</dd>
            </div>
            <div>
              <dt>Descuentos</dt>
              <dd>−{money(preview.discountTotal)}</dd>
            </div>
            {delivery && (
              <div>
                <dt>Domicilio</dt>
                <dd>{money(preview.deliveryFee)}</dd>
              </div>
            )}
            <div className="totals-grand">
              <dt>Total</dt>
              <dd>{money(preview.total)}</dd>
            </div>
          </dl>
        )}
        <p className="form-help">
          {mode === 'sale'
            ? 'La venta descuenta las existencias al registrarse y queda completada.'
            : 'El borrador no compromete stock. Al confirmarlo se reservan las existencias.'}
        </p>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="button primary" disabled={busy || lines.length === 0}>
            {busy
              ? 'Guardando…'
              : draft
                ? 'Guardar cambios'
                : mode === 'sale'
                  ? 'Registrar venta'
                  : 'Guardar borrador'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
