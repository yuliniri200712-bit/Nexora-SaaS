import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Store, ShieldCheck } from 'lucide-react';
import { api, json } from '../../lib/api';
import { useSession } from '../../app/session';
import { PageHeading, ErrorBox, Loading } from '../../components/ui';
export function SettingsPage() {
  const { user, refresh, mailMode } = useSession(),
    qc = useQueryClient(),
    [error, setError] = useState<unknown>(null),
    [success, setSuccess] = useState(false),
    [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ['settings', user?.tenant.id],
    queryFn: () => api<{ name: string; timezone: string; currency: string }>('/settings'),
  });
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      await api('/settings', json('PUT', { name: form.get('name') }));
      await refresh();
      await qc.invalidateQueries();
      setSuccess(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="A LA MEDIDA DE TU COMERCIO"
        title="Configuración"
        description="Los detalles que hacen que este espacio sea tuyo."
      />
      <ErrorBox error={error || query.error} />
      {success && (
        <div className="success-box" role="status">
          Los datos del comercio se actualizaron.
        </div>
      )}
      {query.isPending ? (
        <Loading />
      ) : (
        query.data && (
          <div className="settings-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Datos del negocio</h2>
                  <p>Identidad de tu espacio de trabajo</p>
                </div>
                <Store size={21} />
              </div>
              <form className="settings-form" onSubmit={save}>
                <label>
                  Nombre del comercio
                  <input
                    name="name"
                    defaultValue={query.data.name}
                    minLength={2}
                    maxLength={120}
                    required
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Moneda
                    <input readOnly value={query.data.currency} />
                  </label>
                  <label>
                    Zona horaria
                    <input readOnly value={query.data.timezone} />
                  </label>
                </div>
                <p className="form-help">
                  Esta primera versión opera en pesos colombianos y hora de Colombia.
                </p>
                <button className="button primary" disabled={busy}>
                  {busy ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </form>
            </section>
            <section className="panel settings-aside">
              <ShieldCheck size={26} />
              <h2>Tu negocio, protegido</h2>
              <p>Cada persona accede con su propia cuenta y los permisos de su rol.</p>
              <div className="settings-detail">
                <small>ALMACÉN</small>
                <strong>Almacén principal</strong>
              </div>
              <div className="settings-detail">
                <small>INVITACIONES Y RECUPERACIÓN</small>
                <strong>
                  {mailMode === 'local' ? 'Buzón local de desarrollo' : 'Correo transaccional'}
                </strong>
                <p>
                  {mailMode === 'local'
                    ? 'Los mensajes se guardan en .data/mailbox. No se envía correo real.'
                    : 'Los enlaces se envían mediante el proveedor SMTP configurado.'}
                </p>
              </div>
            </section>
          </div>
        )
      )}
    </>
  );
}
