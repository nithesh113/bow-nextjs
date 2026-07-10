import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TopTab, ModalType } from '@/types'
import { CONFIG } from '@/lib/constants'
import { navigateMonth } from '@/lib/dateUtils'

interface AppState {
  // Navigation
  curY: number
  curM: number
  activeTab: TopTab
  // Modal
  openModal: ModalType
  modalDateKey: string | null
  // FAB
  fabExpanded: boolean
  // Settings — sourced from the server (User.actualTimesEnabled) on hydration.
  // We keep a local mirror so toggling instantly reflects without a round-trip
  // and so existing reads (`useAppStore().perMinutePay`) keep working.
  perMinutePay: boolean
  // Actions
  setTab: (tab: TopTab) => void
  changeMonth: (delta: number) => void
  goToday: () => void
  setModal: (modal: ModalType, dateKey?: string) => void
  closeModal: () => void
  toggleFAB: () => void
  collapseFAB: () => void
  /** Hydrate the per-minute toggle from the server-side user prefs. Called
   *  on session load by AppShell; replaces the local-only mirror. */
  hydratePerMinutePay: (enabled: boolean) => void
  /** Flip the toggle locally and persist to the server. The returned
   *  Promise resolves with the persistent value (or an error message). */
  setPerMinutePay: (val: boolean) => Promise<{ success: boolean; error?: string }>
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      curY: new Date().getFullYear(),
      curM: new Date().getMonth(),
      activeTab: 'calendar',
      openModal: null,
      modalDateKey: null,
      fabExpanded: false,
      perMinutePay: false,

      setTab: (tab) => set({ activeTab: tab }),

      changeMonth: (delta) => {
        const { curY, curM } = get()
        const { year: ny, month: nm } = navigateMonth(curY, curM, delta)
        set({ curY: ny, curM: nm })
      },

      goToday: () => {
        const now = new Date()
        set({ curY: now.getFullYear(), curM: now.getMonth() })
      },

      setModal: (modal, dateKey) =>
        set({ openModal: modal, modalDateKey: dateKey || null }),

      closeModal: () =>
        set({ openModal: null, modalDateKey: null }),

      toggleFAB: () =>
        set((s) => ({ fabExpanded: !s.fabExpanded })),

      collapseFAB: () => set({ fabExpanded: false }),

      hydratePerMinutePay: (enabled) => set({ perMinutePay: !!enabled }),

      setPerMinutePay: async (val) => {
        const next = !!val
        set({ perMinutePay: next })
        try {
          // Lazy-import to keep `'use client'` stores free of server-only deps
          // when the bundle is read during SSR initial render.
          const { setActualTimesEnabled } = await import('@/app/actions/account')
          const res = await setActualTimesEnabled(next)
          if (!res.success) {
            return { success: false, error: res.error || 'Failed to save preference.' }
          }
          return { success: true }
        } catch (err) {
          console.error('[useAppStore.setPerMinutePay] server action failed', err)
          // We intentionally do not roll back — local UX stays consistent and
          // the next server-side hydration will reconcile.
          return { success: false, error: (err as Error).message }
        }
      },
    }),
    {
      name: 'bow_app_state',
      partialize: (s) => ({
        // `curY` / `curM` are genuinely client-only UX state; `perMinutePay`
        // is also persisted as a best-effort mirror but the server copy is
        // authoritative — hydration on session load overrides this.
        curY: s.curY, curM: s.curM, perMinutePay: s.perMinutePay,
      }),
    }
  )
)
