bow-nextjs/
│
├── 📄 package.json              dependencies (next, react, zustand)
├── 📄 tsconfig.json             TypeScript config
├── 📄 next.config.ts            output: 'export' for GitHub Pages
├── 📄 .gitignore
├── 📄 README.md
│
├── app/                         Next.js App Router
│   ├── layout.tsx               fonts (Syne + JetBrains Mono), metadata
│   ├── page.tsx                 loads AppShell (CSR only, no SSR)
│   └── globals.css              CSS variables, base reset, animations
│
├── types/
│   └── index.ts                 ALL TypeScript interfaces (Job, Shift, Budget…)
│
├── lib/                         Pure utilities — no React, no side effects
│   ├── constants.ts             CONFIG, DEFAULT_JOBS, DEFAULT_CATEGORIES
│   ├── dateUtils.ts             dateKey, getWeekStart, calendarGridDates…
│   ├── timeUtils.ts             timeToMins, formatHours, formatYen…
│   └── nightPayEngine.ts        calcShiftHours, calcShiftEarned (minute loop)
│
├── services/                    Side-effect services (localStorage I/O)
│   ├── storage.ts               All localStorage read/write operations
│   ├── exportService.ts         Build JSON backup → trigger download
│   └── importService.ts         Parse JSON → REPLACE or MERGE
│
├── store/                       Zustand stores (global state + persistence)
│   ├── useJobsStore.ts          jobs[] + CRUD
│   ├── useShiftsStore.ts        shifts{} + add/delete/updateActual
│   ├── useTemplatesStore.ts     templates[] + apply to weeks
│   ├── useBudgetStore.ts        budgets{} + categories/goals/expenses
│   └── useAppStore.ts           UI state (curY/curM, activeTab, modal, FAB)
│
├── features/                    Domain logic hooks (composable)
│   ├── calendar/
│   │   ├── useCalendar.ts       Month navigation + stats aggregation
│   │   └── calendarUtils.ts    dayTotalHours, weekTotalEarned, visaBarColor
│   ├── shifts/
│   │   ├── useShifts.ts        Save/delete shift + visa warning check
│   │   └── shiftCalculations.ts  shiftEarningsDisplay, shiftActualDiff
│   ├── budget/
│   │   ├── useBudget.ts        monthEarnings, categoryStats, savings
│   │   └── budgetEngine.ts     waterfallAllocate, carryForwardGoals, goalStatus
│   ├── templates/
│   │   └── useTemplates.ts     previewHours, getUpcomingWeeks, apply
│   └── visa/
│       └── visaEngine.ts       getCurrentWeekStatus, wouldBreachLimit
│
├── hooks/                       Generic React hooks
│   ├── useLocalStorage.ts       Generic typed localStorage hook
│   ├── useSwipeGesture.ts       Touch swipe detection (left/right)
│   └── useModal.ts              open/close/toggle modal state
│
├── styles/
│   └── variables.css            Full CSS variable reference sheet
│
├── public/
│   └── manifest.json            PWA manifest (icons, theme, display)
│
└── components/
    │
    ├── layout/                  App shell structure
    │   ├── AppShell.tsx         Root — renders all tabs + modals + FAB
    │   ├── Topbar.tsx           Sticky header (month nav, export/import)
    │   ├── TopTabs.tsx          5 tab buttons (Calendar…Settings)
    │   └── BottomNav.tsx        Fixed bottom (Trans/Stats/Accounts/More)
    │
    ├── calendar/                Calendar tab
    │   ├── CalendarView.tsx     Assembles legend + visa + grid
    │   ├── CalendarGrid.tsx     Maps weeks → CalendarCell + WeekSummaryRow
    │   ├── CalendarCell.tsx     Single day (color bar, jobs, earnings)
    │   ├── WeekSummaryRow.tsx   Mon–Sun totals + progress bar
    │   ├── VisaBar.tsx          28h tracker (green/yellow/red)
    │   ├── MonthSummary.tsx     Hours / Earned / Days / Jobs row
    │   └── JobLegend.tsx        Color pills per job + rates
    │
    ├── modals/                  Calendar-triggered modals
    │   ├── DayModal.tsx         Day entry (shifts list + add form)
    │   ├── DayShiftsList.tsx    Logged shifts with delete buttons
    │   ├── DayTimeline.tsx      24h visual timeline (06:00→05:00)
    │   ├── JobManagerModal.tsx  Edit jobs (color, name, rates)
    │   ├── VisaWarningModal.tsx 28h limit warning dialog
    │   └── TemplateFormModal.tsx Create new shift template
    │
    ├── templates/               Templates tab
    │   ├── TemplatesView.tsx    List + create button
    │   ├── TemplateCard.tsx     Name, days, job, apply button
    │   └── ApplyTemplateModal.tsx Select weeks to apply to
    │
    ├── budget/                  Budget tab
    │   ├── BudgetView.tsx       Full budget tab (month nav + all sections)
    │   ├── BudgetCategoryCard.tsx Category row (bar, spent, controls)
    │   ├── BudgetGoalCard.tsx   Goal row (progress, %, carry-forward)
    │   └── ExpenseEntryForm.tsx Add expense form + expense list
    │
    ├── summary/
    │   └── SummaryView.tsx      All-time totals, school fee bar, monthly
    │
    ├── settings/
    │   └── SettingsView.tsx     Per-minute toggle, export/import, about
    │
    ├── transactions/
    │   └── TransactionsView.tsx All expenses grouped by date (fixed overlay)
    │
    ├── fab/                     Floating Action Button system
    │   ├── FABButton.tsx        Circle + button (rotates to ×)
    │   ├── FABMenu.tsx          4 pill buttons (expense/shift/actual/template)
    │   └── modals/
    │       ├── ExpenseEntryModal.tsx  Quick expense (category picker inline)
    │       ├── ShiftEntryModal.tsx    Quick shift (smart next-empty-date)
    │       ├── ActualTimeModal.tsx    Log actual login/logout
    │       └── TemplateEntryModal.tsx Quick template create + use now
    │
    └── ui/                      Reusable primitives
        ├── Modal.tsx            Base bottom-sheet modal wrapper
        ├── ProgressBar.tsx      Animated fill bar
        ├── ToggleSwitch.tsx     iOS-style on/off toggle
        ├── TimeInput.tsx        Styled time input with label
        ├── BreakManager.tsx     Add/remove break periods
        └── StatusBadge.tsx      safe/near/over/active/urgent/completed