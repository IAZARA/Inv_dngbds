import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken, subscribeUnauthorized } from '../lib/api';
import type { User } from '../types';

type LoginPayload = { email: string; password: string };

type AuthContextValue = {
  user: User | null;
  token: string | null;
  initializing: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

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

  const value = useMemo(
    () => ({ user, token, initializing, login, logout }),
    [initializing, login, logout, token, user]
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
