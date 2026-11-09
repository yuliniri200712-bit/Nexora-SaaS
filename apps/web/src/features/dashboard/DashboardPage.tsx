import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Package,
  Boxes,
  TriangleAlert,
  Layers,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowUpLeft,
  ArrowRight,
  CalendarDays,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { DashboardDto } from '@nexora/shared';
import { can } from '@nexora/shared';
import { api, today, daysAgo, number, dateTime } from '../../lib/api';
import { useSession } from '../../app/session';
import { PageHeading, Loading, ErrorBox, Empty } from '../../components/ui';
export function DashboardPage() {
  const { user } = useSession();
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['dashboard', user?.tenant.id],
    queryFn: () => api<DashboardDto>(`/reports/dashboard?from=${daysAgo(6)}&to=${today()}`),
  });
  if (isPending) return <Loading />;
  if (error)
    return (
      <>
        <ErrorBox error={error} />
        <button className="button secondary" onClick={() => void refetch()}>
          Reintentar
        </button>
      </>
    );
  if (!data) return null;
  const metrics = [
    {
      label: 'Productos activos',
      value: data.products,
      note: 'Tu catálogo disponible',
      icon: Package,
      tone: 'green',
    },
    {
      label: 'Unidades en stock',
      value: data.units,
      note: 'En tu almacén principal',
      icon: Boxes,
      tone: 'teal',
    },
    {
      label: 'Variantes registradas',
      value: data.variants,
      note: 'Referencias únicas de tu negocio',
      icon: Layers,
      tone: 'neutral',
    },
    {
      label: 'Stock por revisar',
      value: data.lowStock,
      note: data.lowStock ? 'Variantes en el umbral o por debajo' : 'Tus niveles están al día',
      icon: TriangleAlert,
      tone: 'amber',
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="TU NEGOCIO, DE UN VISTAZO"
        title={`Hola, ${user?.name.split(' ')[0]}.`}
        description="Un poco de claridad para empezar un gran día."
        action={
          <>
            <span className="date-chip">
              <CalendarDays size={16} />
              {new Intl.DateTimeFormat('es-CO', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                timeZone: 'America/Bogota',
              }).format(new Date())}
            </span>
            {user && can(user.role, 'catalog:write') && (
              <Link className="button primary" to="/productos?nuevo=1">
                <Plus size={18} />
                Nuevo producto
              </Link>
            )}
          </>
        }
      />
      <section className="welcome-banner">
        <div>
          <span className="small-tag">CADA DETALLE CUENTA</span>
          <h2>Más control. Más posibilidades.</h2>
          <p>Tu inventario organizado, tu equipo conectado y todo listo para el siguiente paso.</p>
          <Link to="/inventario">
            Explorar mi inventario <ArrowRight size={17} />
          </Link>
        </div>
        <div className="banner-graphic" aria-hidden="true">
          <div className="graphic-grid" />
          <Boxes size={110} strokeWidth={0.85} />
          <span className="graphic-spark" />
        </div>
      </section>
      <div className="metric-grid">
        {metrics.map(({ label, value, note, icon: Icon, tone }) => (
          <article className="metric-card" key={label}>
            <div>
              <span>{label}</span>
              <span className={`metric-icon ${tone}`}>
                <Icon size={20} />
              </span>
            </div>
            <strong>{number(value)}</strong>
            <small>{note}</small>
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>El pulso de tu inventario</h2>
              <p>Entradas y salidas · últimos 7 días</p>
            </div>
            <span className="subtle-chip">Unidades</span>
          </div>
          {data.daily.length ? (
            <>
              <div className="chart-legend">
                <span>
                  <i className="legend-dot green" />
                  Entradas
                </span>
                <span>
                  <i className="legend-dot teal" />
                  Salidas
                </span>
              </div>
              <div
                className="chart-container"
                role="img"
                aria-label="Gráfico de entradas y salidas de inventario; detalle disponible en la tabla inferior."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={Array.from({ length: 7 }, (_, i) => {
                      const date = daysAgo(6 - i);
                      return (
                        data.daily.find((d) => d.date === date) ?? {
                          date,
                          incoming: 0,
                          outgoing: 0,
                        }
                      );
                    })}
                    margin={{ top: 12, right: 12, left: -25, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="stockFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--brand-green)" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="var(--brand-green)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 5"
                      vertical={false}
                      stroke="var(--border-soft)"
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => String(v).slice(8)}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: 'var(--muted)' }}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: 'var(--muted)' }}
                    />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="incoming"
                      name="Entradas"
                      stroke="var(--chart-1)"
                      fill="url(#stockFill)"
                      strokeWidth={2.5}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="outgoing"
                      name="Salidas"
                      stroke="var(--chart-2)"
                      fill="transparent"
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <details className="chart-data">
                <summary>Ver datos del gráfico</summary>
                <table>
                  <thead>
                    <tr>
                      <th>Día</th>
                      <th>Entradas</th>
                      <th>Salidas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.map((d) => (
                      <tr key={d.date}>
                        <td>{d.date}</td>
                        <td>{d.incoming}</td>
                        <td>{d.outgoing}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          ) : (
            <Empty
              title="Aquí empieza tu historia"
              description="Registra tu primera entrada de inventario para ver la actividad de tu negocio."
              action={
                <Link className="text-link" to="/inventario">
                  Registrar un movimiento <ArrowRight size={15} />
                </Link>
              }
            />
          )}
        </section>
        <section className="panel stock-panel">
          <div className="panel-heading">
            <div>
              <h2>Un ojo en tu stock</h2>
              <p>Referencias que necesitan atención</p>
            </div>
            <span className="count-badge">{data.lowStock}</span>
          </div>
          {data.alerts.length ? (
            <div className="alert-list">
              {data.alerts.map((a) => (
                <Link to="/inventario" className="stock-alert" key={a.id}>
                  <span className="product-thumb">
                    <Package size={19} />
                  </span>
                  <div>
                    <strong>{a.productName}</strong>
                    <small>
                      {a.sku} · {a.name}
                    </small>
                  </div>
                  <span className={`badge ${a.onHand === 0 ? 'danger' : 'warning'}`}>
                    {a.onHand === 0 ? 'Agotado' : `${a.onHand} uds.`}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              title="Todo en equilibrio"
              description="Las alertas aparecerán cuando una variante alcance su umbral de stock."
            />
          )}
          <Link className="panel-footer-link" to="/inventario">
            Ver inventario completo <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Lo último en tu negocio</h2>
            <p>Movimientos recientes · últimos 7 días</p>
          </div>
          <Link className="text-link" to="/inventario">
            Ver todos <ArrowUpRight size={16} />
          </Link>
        </div>
        {data.recent.length ? (
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
                  <th>Movimiento</th>
                  <th>Cantidad</th>
                  <th>Responsable</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.variant.product.name}</strong>
                      <small>{m.variant.sku}</small>
                    </td>
                    <td>
                      <span className={`badge ${m.quantity > 0 ? 'success' : 'neutral'}`}>
                        {m.quantity > 0 ? <ArrowDownLeft size={13} /> : <ArrowUpLeft size={13} />}{' '}
                        {m.type === 'ADJUSTMENT' ? 'Ajuste' : m.quantity > 0 ? 'Entrada' : 'Salida'}
                      </span>
                    </td>
                    <td className={m.quantity > 0 ? 'positive' : 'negative'}>
                      {m.quantity > 0 ? '+' : ''}
                      {m.quantity}
                    </td>
                    <td>{m.actor.user.name}</td>
                    <td>{dateTime(m.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Todo listo para comenzar"
            description="Cada movimiento de stock quedará registrado aquí, con su fecha y responsable."
          />
        )}
      </section>
    </>
  );
}
