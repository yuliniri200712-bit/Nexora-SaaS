import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Inbox, X } from 'lucide-react';
import { ApiError } from '../lib/api';
import { ZodError } from '@nexora/shared';
export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={18} />
      <div>
        {error instanceof ZodError
          ? 'Revisa los datos del formulario.'
          : error instanceof Error
            ? error.message
            : String(error)}
        {error instanceof ZodError &&
          error.issues.map((issue, i) => <small key={i}>{issue.message}</small>)}
        {error instanceof ApiError &&
          error.fields?.map((f, i) => <small key={i}>{f.message}</small>)}
      </div>
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Inbox size={27} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      Cargando tu negocio…
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="subtitle">{description}</p>
      </div>
      <div className="heading-actions">{action}</div>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label={title}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {total === 0
          ? 'Sin registros'
          : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total}`}
      </span>
      <div>
        <button
          className="icon-button"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
          aria-label="Página anterior"
        >
          <ArrowLeft size={17} />
        </button>
        <span>{page}</span>
        <button
          className="icon-button"
          disabled={page * pageSize >= total}
          onClick={() => onChange(page + 1)}
          aria-label="Página siguiente"
        >
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}
export function Brand() {
  return <span className="brand-mark" role="img" aria-label="Nexora" />;
}
