import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Mail, ShieldCheck } from 'lucide-react';
import type { EmployeeDto, InvitationDto, Role } from '@nexora/shared';
import { roleLabels } from '@nexora/shared';
import { api, json, dateTime } from '../../lib/api';
import { useSession } from '../../app/session';
import { PageHeading, ErrorBox, Loading, Modal } from '../../components/ui';
const assignable: Role[] = ['ADMIN', 'INVENTORY', 'SELLER', 'COURIER'];
export function EmployeesPage() {
  const { user } = useSession(),
    qc = useQueryClient(),
    [modal, setModal] = useState(false),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const query = useQuery({
    queryKey: ['employees', user?.tenant.id],
    queryFn: () =>
      api<{ employees: EmployeeDto[]; invitations: InvitationDto[]; mailMode: string }>(
        '/employees',
      ),
  });
  async function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await api(
        '/employees/invite',
        json('POST', { email: form.get('email'), role: form.get('role') }),
      );
      await qc.invalidateQueries();
      setModal(false);
      setNotice(
        query.data?.mailMode === 'local'
          ? 'Invitación creada. En este entorno local, el enlace está en .data/mailbox. No se envió correo real.'
          : 'Invitación enviada por correo.',
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function update(employee: EmployeeDto, role: Role, active: boolean) {
    setBusy(true);
    setError(null);
    try {
      await api(`/employees/${employee.id}`, json('PATCH', { role, active }));
      await qc.invalidateQueries();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    setBusy(true);
    try {
      await api(`/invitations/${id}`, json('DELETE'));
      await qc.invalidateQueries();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="JUNTOS, TODO FUNCIONA MEJOR"
        title="Mi equipo"
        description="Las personas de tu negocio, con el acceso que necesitan."
        action={
          <button
            className="button primary"
            onClick={() => {
              setModal(true);
              setError(null);
            }}
          >
            <Plus size={18} />
            Invitar persona
          </button>
        }
      />
      {notice && (
        <div className="success-box" role="status">
          {notice}
        </div>
      )}
      {!modal && <ErrorBox error={error} />}
      <ErrorBox error={query.error} />
      {query.isPending ? (
        <Loading />
      ) : (
        <>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Personas del comercio</h2>
                <p>Los cambios de rol cierran las sesiones de esa persona.</p>
              </div>
              <ShieldCheck size={22} />
            </div>
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Tabla con desplazamiento horizontal"
            >
              <table>
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Acceso</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data?.employees.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <div className="product-cell">
                          <span className="user-avatar light">
                            {e.user.name.slice(0, 1).toUpperCase()}
                          </span>
                          <div>
                            <strong>{e.user.name}</strong>
                            <small>{e.user.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        {e.role === 'OWNER' || e.id === user?.membershipId ? (
                          roleLabels[e.role]
                        ) : (
                          <select
                            aria-label={`Rol de ${e.user.name}`}
                            value={e.role}
                            disabled={busy}
                            onChange={(event) =>
                              void update(e, event.target.value as Role, e.active)
                            }
                          >
                            {assignable.map((r) => (
                              <option key={r} value={r}>
                                {roleLabels[r]}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${e.active ? 'success' : 'neutral'}`}>
                          {e.active ? 'Activo' : 'Desactivado'}
                        </span>
                      </td>
                      <td>
                        {e.role !== 'OWNER' && e.id !== user?.membershipId ? (
                          <button
                            className="button secondary small"
                            disabled={busy}
                            onClick={() => void update(e, e.role, !e.active)}
                          >
                            {e.active ? 'Desactivar' : 'Reactivar'}
                          </button>
                        ) : (
                          <span className="muted">Acceso protegido</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {!!query.data?.invitations.length && (
            <section className="panel spaced-panel">
              <div className="panel-heading">
                <div>
                  <h2>Invitaciones pendientes</h2>
                  <p>Válidas durante 48 horas</p>
                </div>
                <Mail size={20} />
              </div>
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Tabla con desplazamiento horizontal"
              >
                <table>
                  <thead>
                    <tr>
                      <th>Correo</th>
                      <th>Rol</th>
                      <th>Vence</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.invitations.map((i) => (
                      <tr key={i.id}>
                        <td>{i.email}</td>
                        <td>{roleLabels[i.role]}</td>
                        <td>{dateTime(i.expiresAt)}</td>
                        <td>
                          <button
                            className="button secondary small"
                            disabled={busy}
                            onClick={() => void revoke(i.id)}
                          >
                            Revocar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
      {modal && (
        <Modal
          title="Invita a tu equipo"
          onClose={() => {
            if (!busy) setModal(false);
          }}
        >
          <form className="modal-body" onSubmit={invite}>
            <ErrorBox error={error} />
            <label>
              Correo electrónico
              <input
                name="email"
                type="email"
                required
                maxLength={191}
                placeholder="persona@negocio.com"
              />
            </label>
            <label>
              Rol
              <select name="role" defaultValue="INVENTORY">
                {assignable.map((r) => (
                  <option key={r} value={r}>
                    {roleLabels[r]}
                  </option>
                ))}
              </select>
            </label>
            <p className="form-help">
              Administrador: gestión del comercio. Inventario: catálogo y stock. Vendedor: consulta
              de catálogo y existencias. Repartidor: sin módulos disponibles hasta la Fase 4.
            </p>
            {query.data?.mailMode === 'local' && (
              <div className="info-box">
                Modo de desarrollo: el correo se guarda en .data/mailbox y no se envía.
              </div>
            )}
            <div className="modal-actions">
              <button className="button primary" disabled={busy}>
                {busy ? 'Creando invitación…' : 'Crear invitación'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
