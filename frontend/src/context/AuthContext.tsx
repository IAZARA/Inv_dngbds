import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, setAuthToken, subscribeUnauthorized } from '../lib/api';
import type { User } from '../types';

type LoginPayload = { email: string; password: string };

type AuthContextValue = {
  user: User | null;
  token: string | null;
  initializing: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
  changePassword: (payload: { currentPassword: string; newPassword: string }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const lastActivityRef = useRef<number>(Date.now());
  const refreshIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  useEffect(() => {
    const unsubscribe = subscribeUnauthorized(() => {
      setTokenState(null);
      setUser(null);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Marca actividad por eventos de usuario y peticiones
  useEffect(() => {
    const markActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events: Array<keyof DocumentEventMap> = ['click', 'keydown', 'mousemove', 'scroll', 'visibilitychange'];
    events.forEach((evt) => window.addEventListener(evt, markActivity, { passive: true }));

    const reqInterceptor = api.interceptors.request.use((config) => {
      markActivity();
      return config;
    });
    const resInterceptor = api.interceptors.response.use(
      (response) => {
        markActivity();
        return response;
      },
      (error) => Promise.reject(error)
    );

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, markActivity));
      api.interceptors.request.eject(reqInterceptor);
      api.interceptors.response.eject(resInterceptor);
    };
  }, []);

  // Renueva el token si hay actividad reciente
  useEffect(() => {
    // Limpia interval anterior
    if (refreshIntervalRef.current) {
      window.clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    if (!token) return;

    const REFRESH_POLL_MS = 5 * 60 * 1000; // cada 5 minutos
    const ACTIVITY_WINDOW_MS = 2 * 60 * 1000; // si hubo actividad en últimos 2 minutos

    const tick = async () => {
      const now = Date.now();
      if (now - lastActivityRef.current <= ACTIVITY_WINDOW_MS) {
        try {
          const { data } = await api.post<{ accessToken: string }>('/auth/refresh');
          setTokenState(data.accessToken);
        } catch (err) {
          // Si falla, no forzamos logout aquí; el flujo 401 global lo manejará
        }
      }
    };

    // Ejecuta un primer intento a los 5 minutos
    refreshIntervalRef.current = window.setInterval(tick, REFRESH_POLL_MS);

    return () => {
      if (refreshIntervalRef.current) {
        window.clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [token]);

  useEffect(() => {
    if (!token) {
      setInitializing(false);
      return;
    }

    let isMounted = true;
    const loadCurrentUser = async () => {
      try {
        const { data } = await api.get<{ user: User }>('/users/me');
        if (isMounted) {
          setUser(data.user);
        }
      } catch (error) {
        console.error('Error cargando usuario actual', error);
        if (isMounted) {
          setTokenState(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setInitializing(false);
        }
      }
    };

    loadCurrentUser();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const login = useCallback(async ({ email, password }: LoginPayload) => {
    const { data } = await api.post<{ accessToken: string; user: User }>('/auth/login', {
      email,
      password
    });
    setTokenState(data.accessToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    setTokenState(null);
    setUser(null);
  }, []);

  const changePassword = useCallback(
    async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      await api.post('/auth/change-password', { currentPassword, newPassword });
    },
    []
  );

  const value = useMemo(
    () => ({ user, token, initializing, login, logout, changePassword }),
    [changePassword, initializing, login, logout, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};
