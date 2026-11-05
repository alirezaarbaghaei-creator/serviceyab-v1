import { create } from 'zustand';
import type { PageId } from '@/types';

interface AppState {
  currentPage: PageId;
  setPage: (p: PageId) => void;

  /** Attempt id for the active exam run (passed between exam pages) */
  activeAttemptId: string | null;
  setActiveAttemptId: (id: string | null) => void;

  /** Result attempt id for the exam result page */
  resultAttemptId: string | null;
  setResultAttemptId: (id: string | null) => void;

  /** True when a running exam blocks navigation away (toast instead of silent loss) */
  examRunning: boolean;
  setExamRunning: (v: boolean) => void;

  /** Brief toast message shown by the shell */
  toast: string | null;
  showToast: (msg: string) => void;
  clearToast: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'dashboard',
  setPage: (p) => set({ currentPage: p }),

  activeAttemptId: null,
  setActiveAttemptId: (id) => set({ activeAttemptId: id }),

  resultAttemptId: null,
  setResultAttemptId: (id) => set({ resultAttemptId: id }),

  examRunning: false,
  setExamRunning: (v) => set({ examRunning: v }),

  toast: null,
  showToast: (msg) => set({ toast: msg }),
  clearToast: () => set({ toast: null }),
}));
