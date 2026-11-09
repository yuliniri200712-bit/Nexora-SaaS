import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, ArrowDownToLine, ArrowUpFromLine, ClipboardList } from 'lucide-react';
import type { DashboardDto } from '@nexora/shared';
import { api, daysAgo, today, download, number } from '../../lib/api';
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
  async function save(kind: 'inventory' | 'movements') {
    setBusy(true);
    setError(null);
    try {
      await download(
        `/reports/${kind}.csv${kind === 'movements' ? `?from=${from}&to=${to}` : ''}`,
        `nexora-${kind === 'inventory' ? 'inventario' : 'movimientos'}.csv`,
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
        description="Conoce cómo se mueve tu inventario y lleva los datos contigo."
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
      <ErrorBox error={error || query.error} />
      {query.isPending ? (
        <Loading />
      ) : (
        query.data && (
          <>
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
