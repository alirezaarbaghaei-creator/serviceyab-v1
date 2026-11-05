import { create } from 'zustand';
import * as api from '@/lib/api';
import type { AppUser } from '@/lib/api';
import { getItem } from '@/lib/safeStorage';

interface AuthState {
  session: { access_token: string } | null;
  user: AppUser | null;
  loading: boolean;
  setSession: (token: string, user: AppUser) => void;
  setUser: (user: AppUser) => void;
  setLoading: (v: boolean) => void;
  signOut: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: true,
  setSession: (token, user) => {
    set({ session: { access_token: token }, user });
  },
  setUser: (user) => set({ user }),
  setLoading: (v) => set({ loading: v }),
  signOut: async () => {
    await api.signOut();
    set({ session: null, user: null });
  },
  restoreSession: async () => {
    const token = getItem('serviceyab_token');
    if (!token) {
      set({ session: null, user: null, loading: false });
      return;
    }
    const user = await api.getMe();
    if (user) {
      set({ session: { access_token: getItem('serviceyab_token') ?? '' }, user, loading: false });
    } else {
      set({ session: null, user: null, loading: false });
    }
  },
}));
