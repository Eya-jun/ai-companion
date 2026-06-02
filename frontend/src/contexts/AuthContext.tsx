import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  authApi,
  profileApi,
  getStoredSession,
  setStoredSession,
  type UserProfile,
  type AuthSession,
} from '../api/client';

interface AuthContextValue {
  session: AuthSession | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      profileApi.get()
        .then(r => setProfile(r.data))
        .then(() => claimLegacyIfNeeded())
        .catch(() => {
          // client.ts 收到 401 已经清过 localStorage,这里同步 React state
          setStoredSession(null);
          setSession(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [session]);

  const claimLegacyIfNeeded = async () => {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem('has_claimed_legacy')) return;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.accessToken) headers['Authorization'] = `Bearer ${session.accessToken}`;
      const apiBase = (import.meta.env.VITE_API_BASE as string | undefined) || 'http://localhost:3000/api';
      await fetch(`${apiBase}/auth/claim-legacy`, { method: 'POST', headers });
      localStorage.setItem('has_claimed_legacy', 'true');
    } catch {
      // 失败也写标志,避免每次启动都重试
      localStorage.setItem('has_claimed_legacy', 'true');
    }
  };

  const login = async (email: string, password: string) => {
    const r = await authApi.login(email, password);
    setStoredSession(r.data);
    setSession(r.data);
  };

  const signup = async (email: string, password: string, displayName: string) => {
    const r = await authApi.signup(email, password, displayName);
    setStoredSession(r.data);
    setSession(r.data);
  };

  const logout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    setStoredSession(null);
    setSession(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    const r = await profileApi.get();
    setProfile(r.data);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    const r = await profileApi.update(data);
    setProfile(r.data);
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, login, signup, logout, refreshProfile, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return ctx;
}
