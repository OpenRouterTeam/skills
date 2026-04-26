import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FeatureFlags } from '../../preload/api.js';

type AppState = {
  theme: 'system' | 'paper' | 'ink';
  sidebarOpen: boolean;
  features: FeatureFlags;
  setTheme: (t: 'system' | 'paper' | 'ink') => void;
  toggleSidebar: () => void;
  setFeatures: (f: FeatureFlags) => void;
};

const DEFAULT_FEATURES: FeatureFlags = {
  autoTitle: true,
  modelPicker: true,
  warmTheme: true,
  workingLoader: true,
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'system',
      sidebarOpen: true,
      features: DEFAULT_FEATURES,
      setTheme: (t) => set({ theme: t }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setFeatures: (f) => set({ features: f }),
    }),
    {
      name: 'app-store',
      partialize: (s) => ({ theme: s.theme, sidebarOpen: s.sidebarOpen }),
    },
  ),
);
