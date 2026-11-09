import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Tags } from 'lucide-react';
import type { CategoryDto } from '@nexora/shared';
import { can } from '@nexora/shared';
import { api, json } from '../../lib/api';
import { useSession } from '../../app/session';
import { PageHeading, ErrorBox, Empty, Loading, Modal } from '../../components/ui';
export function CategoriesPage() {
  const { user } = useSession(),
    qc = useQueryClient(),
    [editing, setEditing] = useState<CategoryDto | 'new' | null>(null),
    [name, setName] = useState(''),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ['categories', user?.tenant.id],
    queryFn: () => api<CategoryDto[]>('/categories'),
  });
  const writable = user && can(user.role, 'catalog:write');
  function edit(category: CategoryDto | 'new') {
    setEditing(category);
    setName(category === 'new' ? '' : category.name);
    setError(null);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(
        editing === 'new' ? '/categories' : `/categories/${editing?.id}`,
        json(editing === 'new' ? 'POST' : 'PUT', { name }),
      );
      await qc.invalidateQueries();
      setEditing(null);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/categories/${id}`, json('DELETE'));
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
        eyebrow="ORDEN QUE SE NOTA"
        title="Categorías"
        description="Organiza tu catálogo de una forma que tenga sentido para tu negocio."
        action={
          writable && (
            <button className="button primary" onClick={() => edit('new')}>
              <Plus size={18} />
              Nueva categoría
            </button>
          )
        }
      />
      {!editing && <ErrorBox error={error} />}
      <ErrorBox error={query.error} />
      {query.isPending ? (
        <Loading />
      ) : query.data?.length ? (
        <div className="category-grid">
          {query.data.map((c) => (
            <article className="panel category-card" key={c.id}>
              <span className="metric-icon teal">
                <Tags size={23} />
              </span>
              <h2>{c.name}</h2>
              <p>{c._count?.products ?? 0} productos asociados</p>
              {writable && (
                <div className="row-actions">
                  <button className="button secondary" onClick={() => edit(c)}>
                    <Pencil size={14} />
                    Editar
                  </button>
                  <button
                    className="icon-button"
                    disabled={busy || (c._count?.products ?? 0) > 0}
                    aria-label={`Eliminar ${c.name}`}
                    title="Solo se eliminan categorías sin productos"
                    onClick={() => void remove(c.id)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        !query.error && (
          <section className="panel">
            <Empty
              title="Cada producto en su lugar"
              description="Crea categorías para encontrar y analizar tu catálogo con facilidad."
            />
          </section>
        )
      )}
      {editing && (
        <Modal
          title={editing === 'new' ? 'Nueva categoría' : 'Editar categoría'}
          onClose={() => {
            if (!busy) setEditing(null);
          }}
        >
          <form className="modal-body" onSubmit={save}>
            <ErrorBox error={error} />
            <label>
              Nombre
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={100}
                placeholder="Ej. Camisas"
              />
            </label>
            <div className="modal-actions">
              <button className="button primary" disabled={busy}>
                {busy ? 'Guardando…' : 'Guardar categoría'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
