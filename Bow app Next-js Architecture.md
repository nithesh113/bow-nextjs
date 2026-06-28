# BOW — Project Structure (v6.4)

> Snapshot of the v6.4 tree. Brought up to date after the localStorage → Neon DB migration (Phases 1-3 + cleanup). Run from `bow-nextjs/` after `npm install`.

```
bow-nextjs/
│
├── 📄 package.json              dependencies (next 16, react 19, zustand, prisma, etc.)
├── 📄 tsconfig.json             TypeScript config (`@/*` aliases root to project root)
├── 📄 next.config.ts            Turbopack defaults; no static export
├── 📄 .gitignore
├── 📄 .npmrc                    `production=false`, `include=dev`, `legacy-peer-deps=true`
├── 📄 README.md
│
├── app/                         Next.js App Router (v16)
│   ├── layout.tsx               fonts (Syne + JetBrains Mono), metadata, Toaster
│   ├── globals.css              CSS variables, base reset, animations
│   ├── auth/actions.ts          register / login / forgot-password / reset-password / verify-email
│   ├── actions/
│   │   ├── account.ts           updateAccount, resendVerificationEmail, setActualTimesEnabled
│   │   ├── shifts.ts            shift CRUD + recompute
│   │   ├── jobs.ts              job CRUD + seedDefaultJobsIfEmpty
│   │   ├── templates.ts         template CRUD
│   │   ├── expenses.ts          categories + expenses CRUD + saveCategoryBudgetByName
│   │   └── budget.ts            notes + goals CRUD (Phase 3)
│   ├── dashboard/page.tsx       Protected dashboard (requires session)
│   ├── login/                   Login page
│   ├── register/                Registration page
│   ├── verify/                  "Check your email" with resend form
│   ├── verify-email/route.ts    GET handler for email token validation
│   ├── forgot-password/         Forgot password page
│   └── reset-password/          Reset password page
│
├── types/
│   └── index.ts                 Job, Shift, Budget*, Template, Expense, etc.
│
├── lib/                         Pure utilities — no React, no side effects
│   ├── constants.ts             CONFIG, DEFAULT_JOBS, DEFAULT_CATEGORIES
│   ├── dateUtils.ts             monthKey, dateKey, navigateMonth, parseMonthKey
│   ├── timeUtils.ts             timeToMins, formatHours, formatYen
│   ├── nightPayEngine.ts        calcShiftHours / calcShiftEarned / recalculateDayTotals
│   └── dayHours.ts              getDayHours / getNightHours (shifts-store bridge)
│
├── services/                    JSON export/import — reads from DB-backed stores
│   ├── exportService.ts         Build JSON backup → trigger download
│   └── importService.ts         Parse JSON → REPLACE or MERGE into Neon
│
├── store/                       Zustand stores — DB-backed where applicable
│   ├── useAppStore.ts           UI state (activeTab, openModal, per-minute toggle)
│   ├── useShiftsStore.ts        UserShift cache (`wh_shifts` Zustand mirror)
│   ├── useJobsStore.ts          UserJob cache (no localStorage round-trip)
│   ├── useTemplatesStore.ts     UserTemplate cache
│   ├── useExpensesStore.ts      UserExpenseCategory + UserExpense cache
│   └── useBudgetStore.ts        Per-month notes + cross-month goals (hydrate on demand)
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
├── prisma/
│   └── schema.prisma            11 models — User through UserBudgetGoal
│
├── public/
│   └── manifest.json            PWA manifest (icons, theme, display)
│
└── components/
    │
    ├── layout/                  App shell structure
    │   ├── AppShell.tsx         Root — renders all tabs + modals + FAB; hydrates from DB
    │   ├── Topbar.tsx           Sticky header (month nav, export/import)
    │   ├── TopTabs.tsx          Tab buttons (Calendar…Account)
    │   └── BottomNav.tsx        Fixed bottom (Templates/FAB/More)
    │
    ├── auth/                    LoginForm, RegisterForm, AuthShell, ResendVerificationForm
    │
    ├── account/                 AccountView — profile & verification UI
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
    │   ├── JobManagerModal.tsx  Edit jobs (color, name, rates) — async save
    │   ├── VisaWarningModal.tsx 28h limit warning dialog
    │   └── TemplateFormModal.tsx Create new shift template
    │
    ├── templates/               Templates tab
    │   ├── TemplatesView.tsx    List + create button
    │   ├── TemplateCard.tsx     Name, days, job, apply button
    │   └── ApplyTemplateModal.tsx Select weeks to apply to (routes through useTemplates.applyTemplateToWeeks)
    │
    ├── budget/                  Budget tab
    │   ├── BudgetView.tsx       Full budget tab (month nav + categories + goals)
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
    │   └── TransactionsView.tsx All expenses grouped by date
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
        ├── Button.tsx
        ├── Card.tsx
        ├── Field.tsx
        ├── PasswordField.tsx
        └── StatusBadge.tsx
```

## What changed since v6.3

- ✘ `services/storage.ts` — deleted; was the localStorage bridge — now superseded
- ✘ `hooks/useLocalStorage.ts` — deleted; dead after stores became DB-backed
- ✘ `app/page.tsx` (CSR-only root) — replaced by `app/(authed)` route group + protected `dashboard/page.tsx`
- ✘ `Bow app Next-js Architecture` `next.config.ts output: 'export'` — Turbopack-default config retained for SSR/Prisma support
- ✓ `app/actions/budget.ts` — new (notes + goals CRUD)
- ✓ `app/actions/jobs.ts` — new (job CRUD + default seeding)
- ✓ `lib/dayHours.ts` — new (shifts-store bridge)
- ✓ `prisma/schema.prisma` — grew from 5 → 11 models
