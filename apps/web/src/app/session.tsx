import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { SessionUser } from '@nexora/shared';
import { api, json, ApiError, refreshCsrf } from '../lib/api';
type Session = {
  user: SessionUser | null;
  loading: boolean;
  error: string;
  mailMode: string;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};
const SessionContext = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<SessionUser | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [mailMode, setMailMode] = useState('');
  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: SessionUser; mailMode: string }>('/auth/session');
      setUser(data.user);
      setMailMode(data.mailMode);
      setError('');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setUser(null);
        setError('');
        queryClient.clear();
      } else setError(e instanceof Error ? e.message : 'Sin conexión.');
    } finally {
      setLoading(false);
    }
  }, [queryClient]);
  useEffect(() => {
    void refreshCsrf()
      .then(refresh)
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
    const onUnauthorized = () => {
      setUser(null);
      queryClient.clear();
    };
    window.addEventListener('nexora:unauthorized', onUnauthorized);
    return () => window.removeEventListener('nexora:unauthorized', onUnauthorized);
  }, [refresh, queryClient]);
  useEffect(() => {
    if (!user) return;
    let lastActivity = Date.now();
    const activity = () => {
      lastActivity = Date.now();
    };
    window.addEventListener('pointerdown', activity);
    window.addEventListener('keydown', activity);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - lastActivity < 10 * 60000)
        void api('/auth/renew', json('POST')).catch(() => refresh());
    }, 10 * 60000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pointerdown', activity);
      window.removeEventListener('keydown', activity);
    };
  }, [user, refresh]);
  const logout = async () => {
    await api('/auth/logout', json('POST'));
    setUser(null);
  };
  return (
    <SessionContext.Provider value={{ user, loading, error, mailMode, refresh, logout }}>
      {children}
    </SessionContext.Provider>
  );
}
export const useSession = () => {
  const session = useContext(SessionContext);
  if (!session) throw new Error('Falta SessionProvider');
  return session;
};
