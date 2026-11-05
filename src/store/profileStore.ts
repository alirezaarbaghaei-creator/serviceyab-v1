import { create } from 'zustand';
import { fetchProfileApi, saveProfileApi, type ApplicantProfile } from '@/lib/api';

interface ProfileState {
  profile: ApplicantProfile | null;
  loading: boolean;
  saving: boolean;
  loadProfile: () => Promise<void>;
  saveProfile: (fields: Partial<ApplicantProfile>) => Promise<boolean>;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  loading: false,
  saving: false,
  loadProfile: async () => {
    set({ loading: true });
    try {
      const profile = await fetchProfileApi();
      set({ profile, loading: false });
    } catch {
      set({ loading: false });
    }
  },
  saveProfile: async (fields) => {
    set({ saving: true });
    try {
      const { profile_complete } = await saveProfileApi(fields);
      const current = get().profile;
      set({
        profile: current ? { ...current, ...fields, profile_complete } : null,
        saving: false,
      });
      return profile_complete;
    } catch (err) {
      set({ saving: false });
      throw err;
    }
  },
}));
