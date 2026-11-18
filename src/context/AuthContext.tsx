import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api.ts';
import type { MemberProfile, User } from '../types.ts';

interface AuthContextValue {
  user: User | null;
  profile: MemberProfile | null;
  loading: boolean;
  hasAdmin: boolean;
  refreshAuth: () => Promise<void>;
  setAuthUser: (user: User | null, profile?: MemberProfile | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [hasAdmin, setHasAdmin] = useState(true);
  const [loading, setLoading] = useState(true);

  const refreshAuth = useCallback(async () => {
    try {
      const status = await apiRequest<{ hasAdmin: boolean }>('/api/auth/status');
      setHasAdmin(status.hasAdmin);
    } catch {
      // Ignore status fetch failure
    }

    try {
      const data = await apiRequest<{ user: User; profile: MemberProfile | null }>('/api/auth/me');
      setUser(data.user);
      setProfile(data.profile);
    } catch {
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  const setAuthUser = useCallback((nextUser: User | null, nextProfile: MemberProfile | null = null) => {
    setUser(nextUser);
    setProfile(nextProfile);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setProfile(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, hasAdmin, refreshAuth, setAuthUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
