import '@fontsource-variable/inter/index.css';
import '@fontsource-variable/outfit/index.css';
import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { can } from '@nexora/shared';
import type { Permission } from '@nexora/shared';
import { SessionProvider, useSession } from './app/session';
import { Shell } from './app/Shell';
import { AuthPage } from './features/auth/AuthPage';
import { ProductsPage } from './features/catalog/ProductsPage';
import { CategoriesPage } from './features/catalog/CategoriesPage';
import { InventoryPage } from './features/inventory/InventoryPage';
import { EmployeesPage } from './features/employees/EmployeesPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { Empty, Loading, ErrorBox } from './components/ui';
import './styles.css';
const DashboardPage = lazy(() =>
  import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15000, refetchOnWindowFocus: true } },
});
function Protected() {
  const session = useSession();
  if (session.loading) return <Loading />;
  if (session.error)
    return (
      <div className="connection-error">
        <ErrorBox error={session.error} />
        <button className="button primary" onClick={() => void session.refresh()}>
          Reintentar conexión
        </button>
      </div>
    );
  return session.user ? <Shell /> : <Navigate to="/ingresar" replace />;
}
function Guard({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { user } = useSession();
  return user && can(user.role, permission) ? (
    children
  ) : (
    <Empty
      title="Acceso restringido"
      description="Tu rol no tiene permiso para consultar este módulo."
    />
  );
}
function Home() {
  const { user } = useSession();
  return user && can(user.role, 'reports:read') ? (
    <DashboardPage />
  ) : user && can(user.role, 'catalog:read') ? (
    <Navigate to="/productos" replace />
  ) : (
    <Empty
      title="Tu cuenta está lista"
      description="El módulo de repartidores se habilitará en una fase posterior. Tu rol no tiene acceso al inventario del comercio."
    />
  );
}
function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/ingresar" element={<AuthPage mode="login" />} />
              <Route path="/registro" element={<AuthPage mode="register" />} />
              <Route path="/recuperar" element={<AuthPage mode="forgot" />} />
              <Route path="/restablecer" element={<AuthPage mode="reset" />} />
              <Route path="/invitacion" element={<AuthPage mode="invite" />} />
              <Route element={<Protected />}>
                <Route path="/" element={<Home />} />
                <Route
                  path="/productos"
                  element={
                    <Guard permission="catalog:read">
                      <ProductsPage />
                    </Guard>
                  }
                />
                <Route
                  path="/categorias"
                  element={
                    <Guard permission="catalog:read">
                      <CategoriesPage />
                    </Guard>
                  }
                />
                <Route
                  path="/inventario"
                  element={
                    <Guard permission="inventory:read">
                      <InventoryPage />
                    </Guard>
                  }
                />
                <Route
                  path="/equipo"
                  element={
                    <Guard permission="employees:manage">
                      <EmployeesPage />
                    </Guard>
                  }
                />
                <Route
                  path="/reportes"
                  element={
                    <Guard permission="reports:read">
                      <ReportsPage />
                    </Guard>
                  }
                />
                <Route
                  path="/configuracion"
                  element={
                    <Guard permission="settings:manage">
                      <SettingsPage />
                    </Guard>
                  }
                />
                <Route
                  path="*"
                  element={
                    <Empty
                      title="Esta página no está disponible"
                      description="Usa la navegación para volver a tu espacio de trabajo."
                    />
                  }
                />
              </Route>
            </Routes>
          </Suspense>
        </SessionProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
