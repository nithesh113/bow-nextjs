/**
 * useJobsStore — BOW v6.
 *
 * Source of truth for `jobs` is the database (`user_jobs` table on Neon,
 * via `app/actions/jobs.ts`). This store is the in-memory view + a thin
 * coordinator for optimistic CRUD calls.
 *
 * Design follows the same pattern as `useTemplatesStore`:
 *  - No `persist` middleware — the DB is the durable copy.
 *  - `fetchJobsFromDB()` loads on session start (idempotent; safe to call
 *    from any consumer).
 *  - Optimistic local updates go ahead of the server call; failures roll
 *    back to the prior state.
 */
import { create } from 'zustand'
import type { Job } from '@/types'
import {
  getJobs,
  createJob as serverCreateJob,
  updateJob as serverUpdateJob,
  deleteJob as serverDeleteJob,
  type JobRow,
} from '@/app/actions/jobs'

interface JobsState {
  jobs: Job[]
  jobsLoading: boolean
  jobsError: string | null

  /** Hydrate from the DB (called once on session start). */
  fetchJobsFromDB: () => Promise<void>

  /** Mutating actions (all hit the server then update local state). */
  addJob: (job: Omit<Job, 'id'> & { id?: string }) => Promise<void>
  updateJob: (id: string, updates: Partial<Job>) => Promise<void>
  removeJob: (id: string) => Promise<void>

  /** Replace jobs in bulk. Pass the full new list (incoming order). */
  setJobs: (jobs: Job[]) => void
}

/** Convert a server-side `JobRow` to the client `Job` shape used everywhere. */
function rowToJob(row: JobRow): Job {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    rate: row.rate,
    nightRate: row.nightRate,
  }
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: [],
  jobsLoading: false,
  jobsError: null,

  fetchJobsFromDB: async () => {
    set({ jobsLoading: true, jobsError: null })
    try {
      const rows = await getJobs()
      set({ jobs: rows.map(rowToJob), jobsLoading: false })
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string }
      if (e?.status === 401 || e?.status === 403) {
        set({ jobs: [], jobsLoading: false })
        return
      }
      console.error('[useJobsStore] fetchJobsFromDB failed', err)
      set({ jobsError: e?.message || 'Failed to load jobs', jobsLoading: false })
    }
  },

  addJob: async (job) => {
    // Optimistic: give the UI an instant row with a temp id, then replace
    // with the server's authoritative user-prefixed id.
    const tempId = job.id || `temp_${Date.now()}`
    const optimisticJob: Job = { ...job, id: tempId }
    set((s) => ({ jobs: [...s.jobs, optimisticJob] }))
    try {
      const created = await serverCreateJob({
        name: job.name,
        color: job.color,
        rate: job.rate,
        nightRate: job.nightRate,
      })
      set((s) => ({
        jobs: s.jobs.map((j) => (j.id === tempId ? created : j)),
      }))
    } catch (err) {
      console.error('[useJobsStore.addJob] DB write failed', err)
      set((s) => ({ jobs: s.jobs.filter((j) => j.id !== tempId) }))
    }
  },

  updateJob: async (id, updates) => {
    const before = get().jobs.find((j) => j.id === id)
    if (!before) return
    const merged: Job = { ...before, ...updates }
    set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? merged : j)) }))
    try {
      const row = await serverUpdateJob(id, merged)
      if (!row) throw new Error('Server returned no row')
      const updated = rowToJob(row)
      set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? updated : j)) }))
    } catch (err) {
      console.error('[useJobsStore.updateJob] DB update failed', err)
      set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? before : j)) }))
    }
  },

  removeJob: async (id) => {
    const before = get().jobs
    const removed = before.find((j) => j.id === id)
    if (!removed) return
    set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }))
    try {
      const res = await serverDeleteJob(id)
      if (!res || res.count === 0) throw new Error('Server delete returned 0 rows')
    } catch (err) {
      console.error('[useJobsStore.removeJob] DB delete failed', err)
      set((s) => {
        const idx = before.findIndex((j) => j.id === id)
        if (idx < 0) return { jobs: [...s.jobs, removed] }
        const next = [...s.jobs]
        next.splice(idx, 0, removed)
        return { jobs: next }
      })
    }
  },

  setJobs: (jobs) => set({ jobs }),
}))