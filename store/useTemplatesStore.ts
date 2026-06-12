import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Template, Shift } from '@/types'
import { dateKey, getWeekStart, weekDays, mondayIndex } from '@/lib/dateUtils'
import { calcShiftHours } from '@/lib/nightPayEngine'
import { setDayHours } from '@/services/storage'

interface TemplatesState {
  templates: Template[]
  addTemplate: (t: Template) => void
  updateTemplate: (id: string, t: Template) => void
  deleteTemplate: (id: string) => void
  setTemplates: (templates: Template[]) => void
  applyTemplateToWeeks: (
    templateId: string,
    weekStarts: Date[],
    addShift: (dk: string, shift: Shift) => void
  ) => void
}

export const useTemplatesStore = create<TemplatesState>()(
  persist(
    (set, get) => ({
      templates: [],

      addTemplate: (t) => set((s) => ({ templates: [...s.templates, t] })),

      updateTemplate: (id, t) =>
        set((s) => ({
          templates: s.templates.map((tmpl) => (tmpl.id === id ? t : tmpl)),
        })),

      deleteTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

      setTemplates: (templates) => set({ templates }),

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
    }),
    { name: 'wh_templates' }
  )
)
