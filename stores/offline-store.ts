// =====================================================
// ClalMobile — Offline Store (Zustand, persisted)
// Tracks network state + queued docs that couldn't post
// while offline, so the SW / foreground can retry them.
// =====================================================

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type PendingDoc = {
  id: string;
  createdAt: number;
  payload: Record<string, unknown>;
  endpoint: string;
};

interface OfflineStore {
  online: boolean;
  pendingDocs: PendingDoc[];
  setOnline: (v: boolean) => void;
  addPending: (doc: PendingDoc) => void;
  removePending: (id: string) => void;
  clearPending: () => void;
}

export const useOfflineStore = create<OfflineStore>()(
  persist(
    (set) => ({
      online: typeof navigator !== "undefined" ? navigator.onLine : true,
      pendingDocs: [],
      setOnline: (v: boolean) => set({ online: v }),
      addPending: (doc: PendingDoc) =>
        set((s) => ({ pendingDocs: [...s.pendingDocs, doc] })),
      removePending: (id: string) =>
        set((s) => ({ pendingDocs: s.pendingDocs.filter((d) => d.id !== id) })),
      clearPending: () => set({ pendingDocs: [] }),
    }),
    {
      name: "clal-offline-v1",
      storage: createJSONStorage(() => localStorage),
      // Only persist pending docs, not the live online flag
      partialize: (state) => ({ pendingDocs: state.pendingDocs }),
    },
  ),
);
