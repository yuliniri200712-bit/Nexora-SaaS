import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  Tags,
  Users,
  ChartNoAxesCombined,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ArrowUpRight,
  ShoppingBag,
  ClipboardList,
  Contact,
} from 'lucide-react';
import { can, roleLabels } from '@nexora/shared';
import type { Permission } from '@nexora/shared';
import { useSession } from './session';
import { Brand, ErrorBox } from '../components/ui';
import { StockAlerts } from '../components/StockAlerts';
import { api, json } from '../lib/api';
const links = [
  { to: '/', label: 'Vista general', icon: LayoutDashboard, permission: 'reports:read' },
  { to: '/productos', label: 'Productos', icon: Package, permission: 'catalog:read' },
  { to: '/inventario', label: 'Inventario', icon: ArrowLeftRight, permission: 'inventory:read' },
  { to: '/categorias', label: 'Categorías', icon: Tags, permission: 'catalog:read' },
  { to: '/ventas', label: 'Ventas', icon: ShoppingBag, permission: 'orders:read' },
  { to: '/pedidos', label: 'Pedidos', icon: ClipboardList, permission: 'orders:read' },
  { to: '/clientes', label: 'Clientes', icon: Contact, permission: 'customers:read' },
  { to: '/reportes', label: 'Reportes', icon: ChartNoAxesCombined, permission: 'reports:read' },
  { to: '/equipo', label: 'Mi equipo', icon: Users, permission: 'employees:manage' },
  { to: '/configuracion', label: 'Configuración', icon: Settings, permission: 'settings:manage' },
] as const;
export function Shell() {
  const { user, logout, refresh } = useSession(),
    [mobile, setMobile] = useState(false),
    [error, setError] = useState<unknown>(null),
    navigate = useNavigate(),
    queryClient = useQueryClient(),
    location = useLocation();
  if (!user) return null;
  const available = links.filter((link) => can(user.role, link.permission as Permission));
  async function leave() {
    try {
      await logout();
      queryClient.clear();
      navigate('/ingresar');
    } catch (e) {
      setError(e);
    }
  }
  async function switchBusiness(membershipId: string) {
    try {
      await api('/auth/switch', json('POST', { membershipId }));
      queryClient.clear();
      await refresh();
      navigate('/');
    } catch (e) {
      setError(e);
    }
  }
  return (
    <div className="app-layout">
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Cerrar navegación"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? 'is-open' : ''}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="mobile-only icon-button"
            aria-label="Cerrar menú"
            onClick={() => setMobile(false)}
          >
            <X />
          </button>
        </div>
        <div className="business-selector">
          <span className="business-avatar">{user.tenant.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <small>MI NEGOCIO</small>
            {user.memberships.length > 1 ? (
              <select
                aria-label="Cambiar comercio"
                value={user.membershipId}
                onChange={(e) => void switchBusiness(e.target.value)}
              >
                {user.memberships.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            ) : (
              <strong title={user.tenant.name}>{user.tenant.name}</strong>
            )}
          </div>
          <ChevronDown size={15} />
        </div>
        <p className="nav-caption">ESPACIO DE TRABAJO</p>
        <nav aria-label="Navegación principal">
          {available.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setMobile(false)}>
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="connected-note">
            <span className="status-dot" />
            <span>Todo empieza con orden.</span>
            <ArrowUpRight size={15} />
          </div>
          <div className="sidebar-user">
            <span className="user-avatar">{user.name.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{roleLabels[user.role]}</small>
            </div>
            <button onClick={() => void leave()} className="icon-button" aria-label="Cerrar sesión">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-only"
              aria-label="Abrir menú"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </button>
            <span>Mi espacio</span>
            <span>/</span>
            <strong>{links.find((l) => l.to === location.pathname)?.label ?? 'NEXORA'}</strong>
          </div>
          <div className="topbar-right">
            {can(user.role, 'reports:read') && <StockAlerts tenantId={user.tenant.id} />}
            <span className="country-label">
              Colombia <span>·</span> COP
            </span>
            <span className="topbar-divider" />
            <span className="user-avatar light">{user.name.slice(0, 1).toUpperCase()}</span>
            <span className="greeting-name">{user.name.split(' ')[0]}</span>
          </div>
        </header>
        <main className="workspace">
          <ErrorBox error={error} />
          <Outlet />
        </main>
        <footer className="workspace-footer">
          <span>
            NEXORA <span>·</span> Tu negocio. Todo conectado.
          </span>
          <span>Un lugar para crecer.</span>
        </footer>
      </div>
    </div>
  );
}
