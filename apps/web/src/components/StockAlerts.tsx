import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import type { DashboardDto } from '@nexora/shared';
import { api, today, daysAgo } from '../lib/api';
export function StockAlerts({ tenantId }: { tenantId: string }) {
  const { data, error } = useQuery({
    queryKey: ['dashboard', tenantId],
    queryFn: () => api<DashboardDto>(`/reports/dashboard?from=${daysAgo(6)}&to=${today()}`),
  });
  return (
    <details className="notifications">
      <summary aria-label="Alertas de inventario">
        <Bell size={18} />
        {!!data?.lowStock && <span className="notification-dot" />}
      </summary>
      <div className="notification-panel">
        <h3>Alertas de inventario</h3>
        {error ? (
          <p>No se pudieron consultar las alertas.</p>
        ) : !data ? (
          <p>Consultando existencias…</p>
        ) : data.alerts.length ? (
          <>
            <p>{data.lowStock} referencias requieren atención.</p>
            {data.alerts.map((a) => (
              <div key={a.id}>
                <strong>{a.productName}</strong>
                <small>
                  {a.sku} · {a.onHand} unidades
                </small>
              </div>
            ))}
          </>
        ) : (
          <p>No tienes alertas de stock.</p>
        )}
      </div>
    </details>
  );
}
