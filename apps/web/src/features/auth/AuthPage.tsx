import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Boxes, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { api, json } from '../../lib/api';
import { useSession } from '../../app/session';
import { Brand, ErrorBox } from '../../components/ui';
export function AuthPage({ mode }: { mode: 'login' | 'register' | 'forgot' | 'reset' | 'invite' }) {
  const session = useSession(),
    navigate = useNavigate(),
    [params] = useSearchParams();
  const [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(''),
    [show, setShow] = useState(false);
  const titles = {
    login: 'Qué bueno tenerte aquí.',
    register: 'Un nuevo comienzo para tu negocio.',
    forgot: 'Recupera tu acceso.',
    reset: 'Elige tu nueva contraseña.',
    invite: 'Tu equipo te está esperando.',
  };
  if (session.user && (mode === 'login' || mode === 'register')) return <Navigate to="/" replace />;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(event.currentTarget),
      value = (key: string) => String(form.get(key) ?? '');
    try {
      if (mode === 'login') {
        await api(
          '/auth/login',
          json('POST', { email: value('email'), password: value('password') }),
        );
        await session.refresh();
        navigate('/');
      }
      if (mode === 'register') {
        await api(
          '/auth/register',
          json('POST', {
            name: value('name'),
            businessName: value('businessName'),
            email: value('email'),
            password: value('password'),
          }),
        );
        await session.refresh();
        navigate('/');
      }
      if (mode === 'forgot') {
        const result = await api<{ message: string; mailMode: string }>(
          '/auth/forgot',
          json('POST', { email: value('email') }),
        );
        setSuccess(
          result.message +
            (result.mailMode === 'local'
              ? ' Entorno local: el mensaje se guarda en .data/mailbox; no se envía correo real.'
              : ''),
        );
      }
      if (mode === 'reset') {
        await api(
          '/auth/reset',
          json('POST', { token: params.get('token') ?? '', password: value('password') }),
        );
        setSuccess('Contraseña actualizada. Ya puedes iniciar sesión.');
      }
      if (mode === 'invite') {
        await api(
          '/invitations/accept',
          json('POST', {
            token: params.get('token') ?? '',
            name: value('name'),
            password: value('password'),
          }),
        );
        setSuccess('Invitación aceptada. Inicia sesión con tu correo y contraseña.');
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Brand />
        <div className="auth-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="art-center">
            <Boxes size={54} strokeWidth={1.2} />
          </div>
          <span className="art-label">
            <span className="status-dot" /> Todo en su lugar
          </span>
        </div>
        <div>
          <p className="eyebrow">EL SIGUIENTE PASO DE TU COMERCIO</p>
          <h2>
            Tu negocio.
            <br />
            <em>Todo conectado.</em>
          </h2>
          <p>
            Menos tareas dispersas. Más claridad para cuidar tu inventario y hacer crecer tu
            negocio.
          </p>
        </div>
        <span className="auth-footer">Hecho para el comercio de Colombia.</span>
      </aside>
      <main className="auth-main">
        <div className="auth-form">
          <span className="small-tag">
            <ShieldCheck size={14} /> TU ESPACIO DE TRABAJO
          </span>
          <h1>{titles[mode]}</h1>
          <p className="subtitle">
            {mode === 'login'
              ? 'Ingresa y retoma el control de tu inventario.'
              : mode === 'register'
                ? 'Crea tu cuenta y configura tu primer comercio.'
                : mode === 'invite'
                  ? 'Si ya tienes cuenta, utiliza tu contraseña actual.'
                  : 'Te acompañamos para volver a tu negocio.'}
          </p>
          <ErrorBox error={error || session.error} />
          {success ? (
            <div className="success-box" role="status">
              {success}
              <Link to="/ingresar" className="text-link">
                Ir a iniciar sesión <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <form onSubmit={submit}>
              {(mode === 'register' || mode === 'invite') && (
                <label>
                  Tu nombre
                  <input
                    name="name"
                    autoComplete="name"
                    minLength={2}
                    maxLength={100}
                    required
                    placeholder="¿Cómo te llamas?"
                  />
                </label>
              )}
              {mode === 'register' && (
                <label>
                  Nombre del negocio
                  <input
                    name="businessName"
                    minLength={2}
                    maxLength={120}
                    required
                    placeholder="El nombre de tu comercio"
                  />
                </label>
              )}
              {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
                <label>
                  Correo electrónico
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={191}
                    required
                    placeholder="tu@negocio.com"
                  />
                </label>
              )}
              {mode !== 'forgot' && (
                <label>
                  Contraseña
                  <div className="password-field">
                    <input
                      name="password"
                      type={show ? 'text' : 'password'}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      minLength={mode === 'login' ? 1 : 12}
                      maxLength={128}
                      required
                      placeholder={mode === 'login' ? 'Tu contraseña' : 'Al menos 12 caracteres'}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setShow(!show)}
                      aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
              )}
              {mode === 'login' && (
                <Link className="forgot-link" to="/recuperar">
                  Olvidé mi contraseña
                </Link>
              )}
              <button className="button primary full" disabled={busy}>
                {busy
                  ? 'Un momento…'
                  : mode === 'login'
                    ? 'Entrar a mi negocio'
                    : mode === 'register'
                      ? 'Crear mi cuenta'
                      : mode === 'forgot'
                        ? 'Enviar enlace'
                        : mode === 'reset'
                          ? 'Guardar contraseña'
                          : 'Aceptar invitación'}
                <ArrowRight size={18} />
              </button>
            </form>
          )}
          <p className="auth-alternate">
            {mode === 'login' ? (
              <>
                ¿Tu negocio aún no está aquí? <Link to="/registro">Crea tu cuenta</Link>
              </>
            ) : (
              <Link to="/ingresar">Volver a iniciar sesión</Link>
            )}
          </p>
          <div className="auth-note">
            <ShieldCheck size={16} />
            <span>Un acceso seguro. Un espacio para tu negocio.</span>
          </div>
        </div>
        <p className="auth-bottom">NEXORA · Gestión que conecta</p>
      </main>
    </div>
  );
}
