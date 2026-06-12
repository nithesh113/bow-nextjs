// ═══════════════════════════════════════════
// useTemplates hook — BOW v6.3
// ═══════════════════════════════════════════

import { useTemplatesStore } from '@/store/useTemplatesStore'
import { useShiftsStore } from '@/store/useShiftsStore'
import { useJobsStore } from '@/store/useJobsStore'
import { getWeekStart } from '@/lib/dateUtils'
import { calcShiftHours } from '@/lib/nightPayEngine'
import { CONFIG } from '@/lib/constants'
import type { Template, Shift } from '@/types'

export function useTemplates() {
  const { templates, addTemplate, deleteTemplate, applyTemplateToWeeks } = useTemplatesStore()
  const { addShift } = useShiftsStore()
  const { jobs } = useJobsStore()

  /** Get next N week-start dates from today */
  const getUpcomingWeeks = (count = CONFIG.APPLY_TEMPLATE_WEEKS): Date[] => {
    const weeks: Date[] = []
    let ws = getWeekStart(new Date())
    for (let i = 0; i < count; i++) {
      weeks.push(new Date(ws))
      ws = new Date(ws)
      ws.setDate(ws.getDate() + 7)
    }
    return weeks
  }

  /** Preview hours per day for a template */
  const previewHours = (template: Template): number => {
    const shift: Shift = { jobId: template.jobId, start: template.start, end: template.end, breaks: [] }
    return calcShiftHours(shift).total
  }

  /** Apply a template to selected week start dates */
  const apply = (templateId: string, weekStarts: Date[]) => {
    applyTemplateToWeeks(templateId, weekStarts, addShift)
  }

  return {
    templates, jobs,
    addTemplate, deleteTemplate,
    getUpcomingWeeks,
    previewHours,
    apply,
  }
}
