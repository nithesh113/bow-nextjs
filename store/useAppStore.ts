import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TopTab, ModalType } from '@/types'
import { CONFIG, MIN_DATE, MAX_DATE } from '@/lib/constants'
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
  // Settings
  perMinutePay: boolean
  // Actions
  setTab: (tab: TopTab) => void
  changeMonth: (delta: number) => void
  goToday: () => void
  setModal: (modal: ModalType, dateKey?: string) => void
  closeModal: () => void
  toggleFAB: () => void
  collapseFAB: () => void
  togglePerMinutePay: () => void
  setPerMinutePay: (val: boolean) => void
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
        const { year: ny, month: nm } = navigateMonth(curY, curM, delta, MIN_DATE, MAX_DATE)
        set({ curY: ny, curM: nm })
      },

      goToday: () => {
        const now = new Date()
        const ny = now.getFullYear()
        const nm = now.getMonth()
        const { year, month } = navigateMonth(ny, nm, 0, MIN_DATE, MAX_DATE)
        set({ curY: year, curM: month })
      },

      setModal: (modal, dateKey) =>
        set({ openModal: modal, modalDateKey: dateKey || null }),

      closeModal: () =>
        set({ openModal: null, modalDateKey: null }),

      toggleFAB: () =>
        set((s) => ({ fabExpanded: !s.fabExpanded })),

      collapseFAB: () => set({ fabExpanded: false }),

      togglePerMinutePay: () =>
        set((s) => ({ perMinutePay: !s.perMinutePay })),

      setPerMinutePay: (val) => set({ perMinutePay: val }),
    }),
    {
      name: 'bow_app_state',
      partialize: (s) => ({
        curY: s.curY, curM: s.curM, perMinutePay: s.perMinutePay,
      }),
    }
  )
)
