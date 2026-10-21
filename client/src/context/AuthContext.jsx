/**
 * Holds the signed-in user. On first load it tries to restore the session
 * from the refresh cookie, so a page reload keeps the user signed in.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, refreshSession, setAccessToken, setSessionExpiredHandler } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous

  const finishSignIn = useCallback((data) => {
    setAccessToken(data.accessToken);
    setUser(data.user);
    setStatus('authenticated');
    return data.user;
  }, []);

  useEffect(() => {
    let active = true;
    refreshSession()
      .then((data) => active && finishSignIn(data))
      .catch(() => active && setStatus('anonymous'));
    return () => {
      active = false;
    };
  }, [finishSignIn]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setStatus('anonymous');
      queryClient.clear();
      toast.error('Your session has ended. Please sign in again.');
    });
  }, [queryClient]);

  const login = useCallback(async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    return finishSignIn(data);
  }, [finishSignIn]);

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    return finishSignIn(data);
  }, [finishSignIn]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
      setStatus('anonymous');
      queryClient.clear();
    }
  }, [queryClient]);

  const value = useMemo(
    () => ({ user, status, login, register, logout, setUser }),
    [user, status, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
