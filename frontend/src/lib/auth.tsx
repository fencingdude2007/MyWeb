import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { API_BASE, api, clearTokens, getAccessToken, setTokens, type User } from "./api";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  applyTokens: (access: string, refresh?: string) => Promise<void>;
  loginWithGoogle: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (getAccessToken()) {
        try {
          setUser(await api.me());
        } catch {
          clearTokens();
        }
      }
      setLoading(false);
    })();
  }, []);

  const loadUser = async () => setUser(await api.me());

  const login = async (email: string, password: string) => {
    const t = await api.login(email, password);
    setTokens(t.access_token, t.refresh_token);
    await loadUser();
  };

  const register = async (email: string, password: string) => {
    const t = await api.register(email, password);
    setTokens(t.access_token, t.refresh_token);
    await loadUser();
  };

  const applyTokens = async (access: string, refresh?: string) => {
    setTokens(access, refresh);
    await loadUser();
  };

  const logout = () => {
    clearTokens();
    setUser(null);
  };

  const loginWithGoogle = () => {
    window.location.href = `${API_BASE}/auth/google/login`;
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, applyTokens, loginWithGoogle, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
