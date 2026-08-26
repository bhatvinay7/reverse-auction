'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type UserRole = 'CUSTOMER' | 'CARRIER' | 'ADMIN';
type Session = { userId: string; role: UserRole };
type AuthValue = { session: Session | null; isLoading: boolean; refresh: () => Promise<void> };
const AuthContext = createContext<AuthValue>({ session: null, isLoading: true, refresh: async () => undefined });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refresh = async () => {
    const token = localStorage.getItem('token');
    if (!token) { setSession(null); setIsLoading(false); return; }
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!response.ok) throw new Error('Session expired');
      const value = await response.json() as Session;
      setSession(value);
      localStorage.setItem('userRole', value.role);
    } catch {
      setSession(null);
      localStorage.removeItem('token');
      localStorage.removeItem('userRole');
    } finally { setIsLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);
  const value = useMemo(() => ({ session, isLoading, refresh }), [session, isLoading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
