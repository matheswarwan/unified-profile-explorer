'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      login: (token: string, user: AuthUser) => {
        set({ token, user });
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', token);
        }
      },
      logout: () => {
        set({ token: null, user: null });
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth-store');
        }
      },
      isAuthenticated: () => {
        const { token } = get();
        if (!token) return false;

        // Basic JWT expiry check
        try {
          const parts = token.split('.');
          if (parts.length !== 3) return false;
          const payload = JSON.parse(atob(parts[1]));
          if (payload.exp && payload.exp * 1000 < Date.now()) {
            return false;
          }
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}
