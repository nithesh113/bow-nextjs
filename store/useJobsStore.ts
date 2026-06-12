import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Job } from '@/types'
import { DEFAULT_JOBS } from '@/lib/constants'

interface JobsState {
  jobs: Job[]
  addJob: (job: Job) => void
  updateJob: (id: string, updates: Partial<Job>) => void
  removeJob: (id: string) => void
  setJobs: (jobs: Job[]) => void
}

export const useJobsStore = create<JobsState>()(
  persist(
    (set) => ({
      jobs: DEFAULT_JOBS,

      addJob: (job) =>
        set((s) => ({ jobs: [...s.jobs, job] })),

      updateJob: (id, updates) =>
        set((s) => ({
          jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
        })),

      removeJob: (id) =>
        set((s) => ({
          jobs: s.jobs.length > 1 ? s.jobs.filter((j) => j.id !== id) : s.jobs,
        })),

      setJobs: (jobs) => set({ jobs }),
    }),
    { name: 'wh_jobs3' }
  )
)
