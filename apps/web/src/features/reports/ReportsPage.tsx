import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Boxes,
  Download,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  Receipt,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import type { DashboardDto, SalesReportDto } from '@nexora/shared';
import { api, daysAgo, today, download, number, money } from '../../lib/api';
import { useSession } from '../../app/session';
import { PageHeading, ErrorBox, Loading, Empty } from '../../components/ui';
export function ReportsPage() {
  const { user } = useSession(),
    [from, setFrom] = useState(daysAgo(6)),
    [to, setTo] = useState(today()),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ['report', user?.tenant.id, from, to],
    queryFn: () => api<DashboardDto>(`/reports/dashboard?from=${from}&to=${to}`),
    enabled: Boolean(from && to),
  });
  const sales = useQuery({
    queryKey: ['sales-report', user?.tenant.id, from, to],
    queryFn: () => api<SalesReportDto>(`/reports/sales?from=${from}&to=${to}`),
    enabled: Boolean(from && to),
  });
  async function save(kind: 'inventory' | 'movements' | 'sales') {
    setBusy(true);
    setError(null);
    try {
      const names = { inventory: 'inventario', movements: 'movimientos', sales: 'ventas' };
      await download(
        `/reports/${kind}.csv${kind === 'inventory' ? '' : `?from=${from}&to=${to}`}`,
        `nexora-${names[kind]}.csv`,
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="DECISIONES CON INFORMACIÓN"
        title="Reportes"
        description="Conoce cómo se mueven tus ventas e inventario y lleva los datos contigo."
      />
      <section className="panel">
        <div className="toolbar report-toolbar">
          <div className="tabs">
            <button
              onClick={() => {
                setFrom(today());
                setTo(today());
              }}
            >
              Hoy
            </button>
            <button
              onClick={() => {
                setFrom(daysAgo(6));
                setTo(today());
              }}
            >
              7 días
            </button>
            <button
              onClick={() => {
                setFrom(today().slice(0, 7) + '-01');
                setTo(today());
              }}
            >
              Este mes
            </button>
          </div>
          <label>
            Desde
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
      </section>
      <ErrorBox error={error || query.error || sales.error} />
      {query.isPending || sales.isPending ? (
        <Loading />
      ) : (
        query.data &&
        sales.data && (
          <>
            <div className="metric-grid">
              <article className="metric-card">
                <div>
                  <span>Ingresos del periodo</span>
                  <Wallet size={20} />
                </div>
                <strong className="money">{money(sales.data.revenue)}</strong>
                <small>Ventas completadas, con domicilio</small>
              </article>
              <article className="metric-card">
                <div>
                  <span>Ventas completadas</span>
                  <ShoppingBag size={20} />
                </div>
                <strong>{number(sales.data.count)}</strong>
                <small>{money(sales.data.discounts)} en descuentos</small>
              </article>
              <article className="metric-card">
                <div>
                  <span>Unidades vendidas</span>
                  <Boxes size={20} />
                </div>
                <strong>{number(sales.data.units)}</strong>
                <small>Productos entregados al cliente</small>
              </article>
              <article className="metric-card">
                <div>
                  <span>Ticket promedio</span>
                  <Receipt size={20} />
                </div>
                <strong className="money">{money(sales.data.averageTicket)}</strong>
                <small>Por venta completada</small>
              </article>
            </div>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Ventas por día</h2>
                  <p>Fechas en hora de Colombia · ventas completadas</p>
                </div>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void save('sales')}
                >
                  <Download size={16} />
                  Exportar ventas
                </button>
              </div>
              {sales.data.daily.length ? (
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
                        <th>Ventas</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.data.daily.map((d) => (
                        <tr key={d.date}>
                          <td>{d.date}</td>
                          <td>{d.count}</td>
                          <td>{money(d.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="Un periodo sin ventas"
                  description="Elige otras fechas o registra una venta."
                />
              )}
            </section>
            <section className="panel spaced-panel spaced-bottom">
              <div className="panel-heading">
                <div>
                  <h2>Productos más vendidos</h2>
                  <p>Por unidades, con ingresos netos de descuentos</p>
                </div>
              </div>
              {sales.data.topProducts.length ? (
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
                        <th>SKU</th>
                        <th>Unidades</th>
                        <th>Ingresos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.data.topProducts.map((p) => (
                        <tr key={p.sku}>
                          <td>
                            {p.productName}
                            <small>{p.variantName}</small>
                          </td>
                          <td>
                            <code>{p.sku}</code>
                          </td>
                          <td>{number(p.units)}</td>
                          <td>{money(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="Sin productos vendidos"
                  description="Aparecerán cuando completes ventas en este periodo."
                />
              )}
            </section>
            <div className="metric-grid three">
              <article className="metric-card">
                <div>
                  <span>Entradas del periodo</span>
                  <ArrowDownToLine size={20} />
                </div>
                <strong>{number(query.data.daily.reduce((s, d) => s + d.incoming, 0))}</strong>
                <small>Unidades incorporadas, incluidos ajustes positivos</small>
              </article>
              <article className="metric-card">
                <div>
                  <span>Salidas del periodo</span>
                  <ArrowUpFromLine size={20} />
                </div>
                <strong>{number(query.data.daily.reduce((s, d) => s + d.outgoing, 0))}</strong>
                <small>Unidades retiradas, incluidos ajustes negativos</small>
              </article>
              <article className="metric-card">
                <div>
                  <span>Existencias actuales</span>
                  <ClipboardList size={20} />
                </div>
                <strong>{number(query.data.units)}</strong>
                <small>Saldo de hoy, independiente del periodo seleccionado</small>
              </article>
            </div>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Resumen diario</h2>
                  <p>Fechas en hora de Colombia · unidades</p>
                </div>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void save('movements')}
                >
                  <Download size={16} />
                  Exportar movimientos
                </button>
              </div>
              {query.data.daily.length ? (
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
                        <th>Entradas</th>
                        <th>Salidas</th>
                        <th>Cambio neto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {query.data.daily.map((d) => (
                        <tr key={d.date}>
                          <td>{d.date}</td>
                          <td>{d.incoming}</td>
                          <td>{d.outgoing}</td>
                          <td>{d.incoming - d.outgoing}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="Un periodo sin movimientos"
                  description="Elige otras fechas o registra una entrada en Inventario."
                />
              )}
            </section>
            <section className="panel spaced-panel">
              <div className="panel-heading">
                <div>
                  <h2>Inventario por categoría</h2>
                  <p>Existencias actuales de productos activos</p>
                </div>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void save('inventory')}
                >
                  <Download size={16} />
                  Exportar inventario
                </button>
              </div>
              {query.data.categories.length ? (
                <div
                  className="table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="Tabla con desplazamiento horizontal"
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Categoría</th>
                        <th>Unidades</th>
                      </tr>
                    </thead>
                    <tbody>
                      {query.data.categories.map((c) => (
                        <tr key={c.name}>
                          <td>{c.name}</td>
                          <td>{c.units}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="Tu catálogo aún está vacío"
                  description="Los productos con existencias aparecerán en este resumen."
                />
              )}
            </section>
          </>
        )
      )}
    </>
  );
}
