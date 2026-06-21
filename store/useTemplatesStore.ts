import { create } from 'zustand'
import type { Template, Shift } from '@/types'
import { dateKey, getWeekStart, weekDays, mondayIndex } from '@/lib/dateUtils'
import { calcShiftHours } from '@/lib/nightPayEngine'
import { setDayHours } from '@/services/storage'
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  type TemplateData,
} from '@/app/actions/templates'

interface TemplatesState {
  templates: Template[]
  templatesLoading: boolean
  templatesError: string | null
  apiReady: boolean
  apiError: string | null
  addTemplate: (t: Template) => Promise<void>
  updateTemplate: (id: string, t: Partial<Template>) => Promise<void>
  deleteTemplate: (id: string) => Promise<void>
  setTemplates: (templates: Template[]) => void
  applyTemplateToWeeks: (
    templateId: string,
    weekStarts: Date[],
    addShift: (dk: string, shift: Shift) => void
  ) => void
  fetchTemplatesFromDB: () => Promise<void>
}

/** Convert a server-side TemplateRow (or input payload) to the client Template shape. */
export function localTemplateToTemplate(
  t: TemplateData & { id?: string }
): Template {
  return {
    id: t.id ?? `t_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: t.name,
    days: t.days,
    jobId: t.jobId,
    start: t.start,
    end: t.end,
    workDetails: t.workDetails ?? null,
  }
}

/** Convert client Template shape to the server's expected input payload. */
export function templateToLocal(t: Template): TemplateData {
  return {
    id: t.id,
    name: t.name,
    days: t.days,
    jobId: t.jobId,
    start: t.start,
    end: t.end,
    workDetails: t.workDetails ?? null,
  }
}

export const useTemplatesStore = create<TemplatesState>()((set, get) => ({
  templates: [],
  templatesLoading: false,
  templatesError: null,

  apiReady: false,
  apiError: null,

  fetchTemplatesFromDB: async () => {
    if (get().apiError === 'not-authenticated') return
    set({ apiError: null, templatesLoading: true })
    try {
      const source = await getTemplates()
      set({
        apiReady: true,
        templates: source.map(localTemplateToTemplate),
        templatesLoading: false,
      })
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string }
      if (e?.status === 401 || e?.status === 403) {
        set({ apiError: 'not-authenticated', templates: [], templatesLoading: false })
        return
      }
      set({
        apiError: e?.message || 'Failed to load templates',
        templatesLoading: false,
      })
    }
  },

  setTemplates: (templates) => set({ templates }),

  addTemplate: async (t) => {
    set({ templatesLoading: true, templatesError: null })
    try {
      const saved = await createTemplate(templateToLocal(t))
      set({
        templates: [localTemplateToTemplate(saved), ...get().templates],
        templatesLoading: false,
      })
      window.dispatchEvent(new Event('bow:template-changed'))
    } catch (err: unknown) {
      const e = err as { message?: string }
      console.error('[useTemplatesStore] addTemplate failed', err)
      set({
        templatesError: e?.message || 'Failed to add template',
        templatesLoading: false,
      })
    }
  },

  updateTemplate: async (id, patch) => {
    set({ templatesLoading: true, templatesError: null })
    try {
      const saved = await updateTemplate(id, patch as Partial<TemplateData>)
      const updated = localTemplateToTemplate(saved)
      set({
        templates: get().templates.map((x) => (x.id === id ? { ...x, ...updated } : x)),
        templatesLoading: false,
      })
      window.dispatchEvent(new Event('bow:template-changed'))
    } catch (err: unknown) {
      const e = err as { message?: string }
      console.error('[useTemplatesStore] updateTemplate failed', err)
      set({
        templatesError: e?.message || 'Failed to update template',
        templatesLoading: false,
      })
    }
  },

  deleteTemplate: async (id) => {
    set({ templatesLoading: true, templatesError: null })
    try {
      await deleteTemplate(id)
      set({
        templates: get().templates.filter((x) => x.id !== id),
        templatesLoading: false,
      })
      window.dispatchEvent(new Event('bow:template-changed'))
    } catch (err: unknown) {
      const e = err as { message?: string }
      console.error('[useTemplatesStore] deleteTemplate failed', err)
      set({
        templatesError: e?.message || 'Failed to delete template',
        templatesLoading: false,
      })
    }
  },

  applyTemplateToWeeks: (templateId, weekStarts, addShift) => {
    const template = get().templates.find((t) => t.id === templateId)
    if (!template) return

    for (const ws of weekStarts) {
      const days = weekDays(ws)
      for (const day of days) {
        const mi = mondayIndex(day)
        if (!template.days.includes(mi)) continue

        const dk = dateKey(day.getFullYear(), day.getMonth(), day.getDate())
        const shift: Shift = {
          jobId: template.jobId,
          start: template.start,
          end: template.end,
          breaks: [],
        }

        const hrs = calcShiftHours(shift)
        setDayHours(dk, template.jobId, hrs.total, hrs.night)
        addShift(dk, shift)
      }
    }
  },
}))

/**
 * Default 4-week window (legacy convenience, kept for compatibility with
 * any caller that imports it). Production code uses getWeekStart + iteration now.
 */
export function getDefaultWeekStarts(count = 4): Date[] {
  const weeks: Date[] = []
  let ws = getWeekStart(new Date())
  for (let i = 0; i < count; i++) {
    weeks.push(new Date(ws))
    ws = new Date(ws)
    ws.setDate(ws.getDate() + 7)
  }
  return weeks
}
