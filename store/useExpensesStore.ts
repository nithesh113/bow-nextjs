import { create } from 'zustand'
import { getCategories, getExpenses, seedDefaultCategories } from '@/app/actions/expenses'

// We mirror the runtime-shape types we need from app/actions/expenses.
export interface CategoryNode {
  id: string
  name: string
  icon: string
  budget: number
  parentId: string | null
  sortOrder: number
  createdAt: string
  children: CategoryNode[]
}

/* ────────────────────────────────────────────────────────────────
 * Cached expense + category store.
 *
 * Source of truth = database. This store is a render-time cache so that
 * repeated views of the same month are instant.
 *
 * Cache rules:
 *  - On first mount of any consumer, fetch the requested month + categories.
 *  - On tab focus / visibility change, refetch the currently visible month.
 *  - On bow:expense-changed event, invalidate the visible month and refetch.
 *  - Other months stay cached until the user revisits them or invalidates.
 */

export interface CachedExpense {
  id: string
  categoryName: string
  categoryIcon: string
  subcategoryName: string | null
  subcategoryIcon: string | null
  amount: number
  date: string
  note: string
}

// Shape row returned by getExpenses — kept local so the store doesn't
// import types from a 'use server' module.
interface RawExpense {
  id: string
  categoryName: string
  categoryIcon: string
  subcategoryName: string | null
  subcategoryIcon: string | null
  amount: number
  date: string
  note: string
}

interface ExpensesState {
  // Per-month caches of mapped expenses. Key = "YYYY-MM".
  expensesByMonth: Record<string, CachedExpense[]>
  // Which months we have already loaded (so re-mount doesn't refetch).
  loadedMonths: Set<string>
  // Categories are user-global, not month-scoped.
  categories: CategoryNode[]
  hasLoadedCategories: boolean
  // Track ongoing loads so two views asking for the same month dedupe.
  inflightMonths: Set<string>
  inflightCategories: boolean

  loadMonth: (mk: string) => Promise<void>
  loadCategories: () => Promise<void>
  invalidate: () => void
  invalidateMonth: (mk: string) => void
}

function mapExpense(e: RawExpense): CachedExpense {
  return {
    id: e.id,
    categoryName: e.categoryName,
    categoryIcon: e.categoryIcon,
    subcategoryName: e.subcategoryName,
    subcategoryIcon: e.subcategoryIcon,
    amount: e.amount,
    date: e.date,
    note: e.note,
  }
}

export const useExpensesStore = create<ExpensesState>((set, get) => ({
  expensesByMonth: {},
  loadedMonths: new Set(),
  categories: [],
  hasLoadedCategories: false,
  inflightMonths: new Set(),
  inflightCategories: false,

  loadCategories: async () => {
    const { hasLoadedCategories, inflightCategories } = get()
    if (hasLoadedCategories || inflightCategories) return
    set({ inflightCategories: true })
    try {
      let cats = await getCategories()
      if (!cats || cats.length === 0) cats = await seedDefaultCategories()
      set(state => ({
        categories: cats || [],
        hasLoadedCategories: true,
      }))
    } catch (err) {
      console.warn('[useExpensesStore] loadCategories failed', err)
    } finally {
      set({ inflightCategories: false })
    }
    },

    loadMonth: async (mk: string) => {
    const state = get()
    if (state.loadedMonths.has(mk) || state.inflightMonths.has(mk)) return
    const nextInflight = new Set(state.inflightMonths)
    nextInflight.add(mk)
    set({ inflightMonths: nextInflight })
    try {
      // Also ensure categories are loaded (ExpenseView + BudgetView both need them).
      await get().loadCategories()
      const exps = await getExpenses(mk)
      const mapped = (exps || []).map(mapExpense)
      set(state => {
        const nextLoaded = new Set(state.loadedMonths)
        nextLoaded.add(mk)
        const dropped = new Set(state.inflightMonths)
        dropped.delete(mk)
        return {
          expensesByMonth: { ...state.expensesByMonth, [mk]: mapped },
          loadedMonths: nextLoaded,
          inflightMonths: dropped,
        }
      })
    } catch (err) {
      console.warn('[useExpensesStore] loadMonth failed', mk, err)
      set(state => {
        const dropped = new Set(state.inflightMonths)
        dropped.delete(mk)
        return { inflightMonths: dropped }
      })
    }
    },

  invalidate: () => {
    set({
      expensesByMonth: {},
      loadedMonths: new Set(),
      hasLoadedCategories: false,
      categories: [],
      inflightMonths: new Set(),
      inflightCategories: false,
    })
  },

  invalidateMonth: (mk: string) => {
    set(state => {
      const nextLoaded = new Set(state.loadedMonths)
      nextLoaded.delete(mk)
      const nextExpenses = { ...state.expensesByMonth }
      delete nextExpenses[mk]
      return {
        loadedMonths: nextLoaded,
        expensesByMonth: nextExpenses,
      }
    })
  },
}))

/* Listen to window-level triggers that should bust the cache.
 * Wired once from a top-level client component (AppShell).
 * On any of these events, the cache drops ALL stored data so the
 * next visible view refetches from the database. */
let cacheListenersStarted = false
export function startExpensesInvalidationListeners(): void {
  if (typeof window === 'undefined') return
  if (cacheListenersStarted) return
  cacheListenersStarted = true

  const bust = () => {
    useExpensesStore.getState().invalidate()
  }

  window.addEventListener('focus', bust)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') bust()
  })
  window.addEventListener('bow:expense-changed', bust)
}
