'use client'

import { useAppStore } from '@/store/useAppStore'
import Topbar from './Topbar'
import TopTabs from './TopTabs'
import BottomNav from './BottomNav'
import CalendarView from '@/components/calendar/CalendarView'
import TemplatesView from '@/components/templates/TemplatesView'
import BudgetView from '@/components/budget/BudgetView'
import SummaryView from '@/components/summary/SummaryView'
import SettingsView from '@/components/settings/SettingsView'
import TransactionsView from '@/components/transactions/TransactionsView'
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

export default function AppShell({ userName }: { userName: string }) {
  const { activeTab, activeBottomTab, openModal, fabExpanded } = useAppStore()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 'calc(140px + env(safe-area-inset-bottom, 0px))' }}>

      {/* ── Header ─────────────────────────── */}
      <Topbar userName={userName} />
      <TopTabs />

      {/* ── Main Tab Content ───────────────── */}
      {activeBottomTab === null && (
        <>
          {activeTab === 'calendar'  && <CalendarView />}
          {activeTab === 'templates' && <TemplatesView />}
          {activeTab === 'budget'    && <BudgetView />}
          {activeTab === 'summary'   && <SummaryView />}
          {activeTab === 'settings'  && <SettingsView />}
        </>
      )}

      {/* ── Bottom Tab Panels ──────────────── */}
      {activeBottomTab === 'transactions' && <TransactionsView />}
      {activeBottomTab === 'stats' && (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted)' }}>
          📊 Stats coming soon…
        </div>
      )}
      {activeBottomTab === 'accounts' && (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted)' }}>
          🏦 Accounts coming soon…
        </div>
      )}
      {activeBottomTab === 'more' && (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted)' }}>
          ⋯ More options coming soon…
        </div>
      )}

      {/* ── Bottom Navigation ──────────────── */}
      <BottomNav />

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
