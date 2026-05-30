'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface ModuleSummary {
  code: string;
  is_active: boolean;
  activated_at?: string;
}

interface Account {
  id: number;
  email: string | null;
  phone: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  display_name: string;
  avatar_url: string | null;
  onboarding_stage: string;
  preferences: string[];
  modules: ModuleSummary[];
  totp_enabled: boolean;
  created_at: string;
  last_login_at: string | null;
}

interface AuthContextType {
  account: Account | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refresh: () => Promise<void>;
  hasModule: (code: string) => boolean;
  hasPermission: (permission: string) => boolean;
  activateModule: (code: string) => Promise<void>;
  deactivateModule: (code: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccount = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAccount(data);
        setError(null);
        return data;
      }
      if (res.status === 401) {
        setAccount(null);
        return null;
      }
      return null;
    } catch {
      setAccount(null);
      return null;
    }
  }, []);

  useEffect(() => {
    fetchAccount().finally(() => setLoading(false));
  }, [fetchAccount]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      await fetchAccount();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    setAccount(null);
    window.location.href = '/auth/login';
  };

  const logoutAll = async () => {
    try {
      await fetch('/api/auth/logout/all', { method: 'POST', credentials: 'include' });
    } catch {}
    setAccount(null);
    window.location.href = '/auth/login';
  };

  const refresh = async () => {
    await fetchAccount();
  };

  const hasModule = (code: string): boolean => {
    return account?.modules?.some(m => m.code === code && m.is_active) ?? false;
  };

  const hasPermission = (_permission: string): boolean => {
    return true; // Backend enforces permissions; frontend shows/hides UI
    // In future: fetch /api/account/permissions and check membership
  };

  const activateModule = async (code: string) => {
    const res = await fetch('/api/account/modules/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ module_code: code }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to activate module');
    }
    await fetchAccount();
  };

  const deactivateModule = async (code: string) => {
    const res = await fetch('/api/account/modules/deactivate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ module_code: code }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to deactivate module');
    }
    await fetchAccount();
  };

  return (
    <AuthContext.Provider value={{
      account, loading, error,
      login, logout, logoutAll, refresh,
      hasModule, hasPermission,
      activateModule, deactivateModule,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
