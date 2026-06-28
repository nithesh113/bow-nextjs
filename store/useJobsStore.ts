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
 *  - `seedJobsIfEmpty()` runs once on first dashboard mount for new users
 *    so they don't see an empty job list.
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
  seedDefaultJobsIfEmpty,
  type JobRow,
  type JobData,
} from '@/app/actions/jobs'

interface JobsState {
  jobs: Job[]
  jobsLoading: boolean
  jobsError: string | null

  /** Hydrate from the DB (called once on session start). */
  fetchJobsFromDB: () => Promise<void>
  /** Idempotent — seeds the default McDonald's + Big Boy jobs on a new user's first run. */
  seedJobs: () => Promise<void>

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

/** Mint a fresh client-side job id (same shape the modal used to generate locally). */
function newJobId(): string {
  return `j_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
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
      // 401/403 are normal during unauthenticated sessions; don't surface
      // them as user-visible errors. Anything else is logged + stored.
      if (e?.status === 401 || e?.status === 403) {
        set({ jobs: [], jobsLoading: false })
        return
      }
      console.error('[useJobsStore] fetchJobsFromDB failed', err)
      set({ jobsError: e?.message || 'Failed to load jobs', jobsLoading: false })
    }
  },

  seedJobs: async () => {
    try {
      const rows = await seedDefaultJobsIfEmpty()
      set({ jobs: rows.map(rowToJob) })
    } catch (err) {
      // 401/403 are normal during unauthenticated sessions; otherwise log.
      const e = err as { status?: number; message?: string }
      if (e?.status === 401 || e?.status === 403) return
      console.error('[useJobsStore] seedJobs failed', err)
    }
  },

  addJob: async (job) => {
    // Optimistic — give the UI an instant row, then let the DB id win.
    const optimisticId = job.id || newJobId()
    const optimisticJob: Job = { ...job, id: optimisticId }
    set((s) => ({ jobs: [...s.jobs, optimisticJob] }))
    try {
      const data: JobData = {
        id: optimisticId,
        name: optimisticJob.name,
        color: optimisticJob.color,
        rate: optimisticJob.rate,
        nightRate: optimisticJob.nightRate,
      }
      const row = await serverCreateJob(data)
      const created = rowToJob(row)
      // Replace the optimistic row with the server's authoritative id.
      set((s) => ({
        jobs: s.jobs.map((j) => (j.id === optimisticId ? created : j)),
      }))
    } catch (err) {
      console.error('[useJobsStore.addJob] DB write failed', err)
      // Roll back the optimistic add.
      set((s) => ({ jobs: s.jobs.filter((j) => j.id !== optimisticId) }))
    }
  },

  updateJob: async (id, updates) => {
    const before = get().jobs.find((j) => j.id === id)
    if (!before) return
    // Optimistic merge.
    const merged: Job = { ...before, ...updates }
    set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? merged : j)) }))
    try {
      const row = await serverUpdateJob(id, merged)
      if (!row) throw new Error('Server returned no row')
      const updated = rowToJob(row)
      set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? updated : j)) }))
    } catch (err) {
      console.error('[useJobsStore.updateJob] DB update failed', err)
      // Roll back.
      set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? before : j)) }))
    }
  },

  removeJob: async (id) => {
    const before = get().jobs
    const removed = before.find((j) => j.id === id)
    if (!removed) return
    // Optimistic remove.
    set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }))
    try {
      const res = await serverDeleteJob(id)
      if (!res || res.count === 0) throw new Error('Server delete returned 0 rows')
    } catch (err) {
      console.error('[useJobsStore.removeJob] DB delete failed', err)
      // Roll back — re-insert at the position it had.
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
