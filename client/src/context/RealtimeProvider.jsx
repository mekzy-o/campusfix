/**
 * Real-time updates. Opens a Socket.IO connection for the signed-in user and
 * refreshes the affected data whenever the server announces a change, so
 * dashboards, lists and badges update without reloading the page.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getAccessToken, refreshSession } from '../lib/api';
import { useAuth } from './AuthContext';

const RealtimeContext = createContext({ connected: false });

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) return undefined;

    const socket = io({
      // Read the latest token on every (re)connect attempt.
      auth: (cb) => cb({ token: getAccessToken() }),
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', async (err) => {
      setConnected(false);
      if (/expired|invalid/i.test(err.message)) {
        try {
          await refreshSession();
          socket.connect();
        } catch {
          /* handled by the API client */
        }
      }
    });

    socket.on('notification:new', (n) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast(n.title, { description: n.message });
    });

    socket.on('request:updated', (payload) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      if (payload?.id) queryClient.invalidateQueries({ queryKey: ['request', payload.id] });
    });

    return () => {
      socket.disconnect();
      setConnected(false);
    };
  }, [user, queryClient]);

  return <RealtimeContext.Provider value={{ connected }}>{children}</RealtimeContext.Provider>;
}

export const useRealtime = () => useContext(RealtimeContext);
