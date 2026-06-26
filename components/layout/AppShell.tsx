'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { startExpensesInvalidationListeners } from '@/store/useExpensesStore'
import Topbar from './Topbar'
import TopTabs from './TopTabs'
import CalendarView from '@/components/calendar/CalendarView'
import TemplatesView from '@/components/templates/TemplatesView'
import BudgetView from '@/components/budget/BudgetView'
import SummaryView from '@/components/summary/SummaryView'
import ExpenseView from '@/components/expenses/ExpenseView'
import AccountView from '@/components/account/AccountView'
import DayModal from '@/components/modals/DayModal'
import JobManagerModal from '@/components/modals/JobManagerModal'
import VisaWarningModal from '@/components/modals/VisaWarningModal'
import TemplateFormModal from '@/components/modals/TemplateFormModal'
import ApplyTemplateModal from '@/components/templates/ApplyTemplateModal'
import FABButton from '@/components/fab/FABButton'
import FABMenu from '@/components/fab/FABMenu'
import ExpenseEntryModal from '@/components/fab/modals/ExpenseEntryModal'
import ShiftEntryModal from '@/components/fab/modals/ShiftEntryModal'
import ActualTimeModal from '@/components/fab/modals/ActualTimeModal'
import TemplateEntryModal from '@/components/fab/modals/TemplateEntryModal'
import { useShiftsStore } from '@/store/useShiftsStore'
import { AuthUser } from '@/lib/auth/session'

export default function AppShell({ user }: { user: AuthUser }) {
  const { activeTab, openModal, fabExpanded, hydratePerMinutePay } = useAppStore()
  const { syncShiftsFromDB } = useShiftsStore()

  // Hydrate the per-minute toggle from the server (User.actualTimesEnabled).
  useEffect(() => {
    hydratePerMinutePay(user.actualTimesEnabled)
  }, [hydratePerMinutePay, user.actualTimesEnabled])

  // Single boot: hook up focus/visibility/event listeners that bust
  // the expense cache so the next view rendering refetches from DB.
  useEffect(() => {
    startExpensesInvalidationListeners()
    syncShiftsFromDB()
  }, [syncShiftsFromDB])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>

      {/* ── Header ─────────────────────────── */}
      <Topbar userName={user.name} />
      <TopTabs />

      {/* ── Main Tab Content ───────────────── */}
      {activeTab === 'calendar'  && <CalendarView />}
      {activeTab === 'templates' && <TemplatesView />}
      {activeTab === 'budget'    && <BudgetView />}
      {activeTab === 'expenses'  && <ExpenseView />}
      {activeTab === 'summary'   && <SummaryView user={user} />}
      {activeTab === 'account'   && <AccountView user={user} />}

      {/* ── FAB System ─────────────────────── */}
      {fabExpanded && <FABMenu />}
      <FABButton />

      {/* ── Modals ─────────────────────────── */}
      {openModal === 'day'            && <DayModal />}
      {openModal === 'jobManager'     && <JobManagerModal />}
      {openModal === 'visaWarning'    && <VisaWarningModal />}
      {openModal === 'templateForm'   && <TemplateFormModal />}
      {openModal === 'applyTemplate'  && <ApplyTemplateModal />}
      {openModal === 'fabExpense'     && <ExpenseEntryModal />}
      {openModal === 'fabShift'       && <ShiftEntryModal />}
      {openModal === 'fabActualTime'  && <ActualTimeModal />}
      {openModal === 'fabTemplate'    && <TemplateEntryModal />}
    </div>
  )
}
