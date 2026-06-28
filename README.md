# BOW — Japan Work Hours & Budget Tracker

**Version:** 6.4 | **Stack:** Next.js 16 · TypeScript · Zustand · PostgreSQL (Neon) · Prisma 6 · Resend · Sonner

> Budget + Overtime + Work tracker for Japan international students on a student visa. Tracks your 28h/week work limit, night-pay premiums, budget allocations, and savings goals — all from a mobile-first dark-mode app.

> **Persistence model:** As of v6.4, **all durable user data lives in Neon Postgres** via Prisma. The browser keeps a ZUSTAND cache (`wh_shifts` mirror only) so the calendar renders instantly while the DB re-syncs. There is no other `localStorage` round-trip — `wh_jobs3`, `wh_budgets`, `wh_perMinute`, `wh_categories`, etc. are gone.

---

## Quick Start

```bash
# 1. Install dependencies (Windows: see .npmrc — global omit=dev is overridden)
npm install

# 2. Configure environment variables
cp .env.example .env
# Fill in DATABASE_URL, RESEND_API_KEY, APP_URL, EMAIL_FROM

# 3. Push database schema to your database
npm run prisma:push

# 4. Generate Prisma client types
#    ⚠️ Windows: stop the dev server first before running this
npm run prisma:generate

# 5. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

> LAN access from a phone: APP_URL must reflect the LAN address (e.g. `http://192.168.0.22:3000`) so verification/password-reset emails embed the right link.

---

## Features

### 🔐 Authentication & Accounts
- Secure registration with **email verification** (via Resend)
- Login with email + password (bcrypt hashed, session-based) — `Session` table
- **Forgot password** — email reset link with 1-hour expiry (single-use `PasswordResetToken`)
- **Resend verification email** — from the `/verify` page or Account page
- Verification status banner & badge in the Account page
- Persistent sessions via HTTP-only cookies (30-day expiry)

### 👤 Account Management
- Editable profile: **name**, **email**, **currency**, **location**
- Per-user **currency selector** (JPY, USD, EUR, GBP, INR, AUD, CAD)
- Per-user **location selector** (Japan, US, UK, India, Australia, etc.)
- Sonner toast notifications for all save/error events

### 📅 Work Calendar
- Monthly calendar with per-day shift tracking
- Japan student visa **28h/week compliance tracker** with colour-coded VisaBar
- **Scheduled vs Actual** hours comparison per day
- Support for multiple jobs per day — hours derived from `UserShift` rows

### 💰 Budget & Finance
- Monthly budget with **waterfall allocation** across categories
- **Savings goals** with carry-forward from previous months — `UserBudgetGoal` (cross-month) + per-month allocation in `monthlyProgress` JSON
- Monthly notes per `monthKey` — `UserBudgetMonthMeta`
- Budget categories with colour coding and progress tracking — DB-backed `UserExpenseCategory`

### 🧾 Transactions
- Log work shifts, expenses, and actual pay
- View and filter all financial transactions
- All entries sync to the DB through server actions

### 🌙 Night Pay Engine
- Automatic **night-pay premium** calculation for hours between 22:00–05:00 in `lib/nightPayEngine.ts`
- Per-minute pay toggle (`User.actualTimesEnabled`) for granular calculations
- Day/night hour bridges in `lib/dayHours.ts` read from the in-memory `useShiftsStore.dayTotals` (derived from `UserShift`)

### 📋 Templates
- Create reusable shift templates for recurring work patterns
- Apply templates directly from the calendar via `ApplyTemplateModal`
- "Apply template to week" writes shifts via the standard `addShift` server action

### ⚡ FAB Quick Entry
- Floating Action Button with 4 fast-entry modes:
  - Add Expense
  - Log Shift
  - Log Actual Time
  - Apply Template

### 💾 Backup & Restore
- Full JSON **export** of all persisted state (reads from DB-backed stores)
- **Import** from a previous JSON backup (`mode: 'merge'` or `'replace'`) — writes through to Neon
- Data lives in Postgres; the JSON is a portability tool, not the source of truth

### 🎨 UI & Design
- **Dark theme** with CSS variables design system in `app/globals.css`
- Mobile-first, PWA-ready (manifest + apple web app meta)
- Smooth animations (`slideUp`, `fadeIn`)
- Sonner toast notifications app-wide
- Bottom navigation bar with swipe gesture support
- Top navigation tabs for primary views

---

## Navigation Structure

### Top Navigation Tabs
| Tab | View |
|-----|------|
| 📅 Calendar | Monthly work calendar |
| 💰 Budget | Budget allocations & goals |
| 📊 Summary | Cumulative earnings & hours |
| 📋 Transactions | All transaction history |
| 👤 Account | Profile, preferences & verification |

### Bottom Navigation
| Tab | View |
|-----|------|
| 🏠 Home | Dashboard |
| 📋 Templates | Shift templates |
| ⚡ FAB | Quick entry menu |
| ⋯ More | Settings (export/import, per-minute pay) |

---

## Authentication Flow

| Step | What Happens |
|------|-------------|
| **Register** | Create account → verification email sent → redirect to `/verify` |
| **Verify Email** | Click link → token validated → session created → dashboard |
| **Resend** | Request new link from `/verify?email=...` or Account page |
| **Login** | Email + password → 30-day session cookie → dashboard |
| **Forgot Password** | Email reset link → `/reset-password?token=...` → new password |
| **Password Changed** | Confirmation email sent, all old sessions invalidated |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (e.g. Neon) |
| `RESEND_API_KEY` | ✅ | API key for transactional emails |
| `APP_URL` | ✅ | Base URL the password-reset/verify emails reference — use the LAN address when testing from a phone |
| `EMAIL_FROM` | ✅ | Sender address (e.g. `BOW <noreply@yourdomain.com>`) |
| `AUTH_COOKIE_NAME` | ⚙️ | Session cookie name (default: `bow_session`) |

---

## Business Rules

| Rule | Detail |
|------|--------|
| Weekly hour limit | 28 hours (Mon–Sun) |
| Night-pay hours | 22:00–05:00 premium rate |
| App date range | Apr 2026 – Sep 2027 (18 months) |
| School fee target | ¥840,000 |
| Week start | Monday |

---

## Database Schema

> **Prisma + Neon PostgreSQL.** All user data is server-side; this schema is the source of truth.

```bash
# Apply schema changes to the database
npm run prisma:push

# Regenerate Prisma Client types
# ⚠️ Windows: stop `npm run dev` first to avoid EPERM file-lock errors
npm run prisma:generate
```

| Model | Purpose |
|-------|---------|
| `User` | Account: name, email, passwordHash, currency, location, emailVerified, actualTimesEnabled |
| `Session` | Active login sessions (tokenHash, expiresAt) |
| `VerificationToken` | Email verification tokens — 24h expiry |
| `PasswordResetToken` | Password reset tokens — 1h expiry, single-use |
| `UserTemplate` | Reusable shift template — name + weekDays + shifts JSON |
| `UserShift` | Per-day shift rows (jobId, start, end, actualLogin/Logout, breaks JSON, workDetails, source) |
| `UserJob` | Per-user job definitions (name, color, rate, nightRate) — replaces the `wh_jobs3` localStorage key |
| `UserExpenseCategory` | Expense categories with parent/child + budget — replaces the `wh_categories` localStorage key |
| `UserExpense` | Per-month expense rows — replaces the `wh_budgets.expenses` slice |
| `UserBudgetMonthMeta` | Per (user, monthKey) free-text notes — replaces the `wh_budgets.notes` slice |
| `UserBudgetGoal` | Cross-month savings goals with `monthlyProgress` JSON — replaces the `wh_budgets.goals` slice |

### Server Action Modules
| Path | Responsibility |
|------|----------------|
| `app/auth/actions.ts` | register / login / forgot-password / reset-password / verify-email |
| `app/actions/account.ts` | updateAccount / resendVerificationEmail |
| `app/actions/shifts.ts` | syncShiftsFromDB / addShift / updateShift / deleteShift / recompute |
| `app/actions/jobs.ts` | getJobs / createJob / updateJob / deleteJob / seedDefaultJobsIfEmpty |
| `app/actions/templates.ts` | getTemplates / createTemplate / updateTemplate / deleteTemplate |
| `app/actions/expenses.ts` | categories + expenses CRUD + `saveCategoryBudgetByName` |
| `app/actions/budget.ts` | `getBudgetState` + month-meta CRUD + goal CRUD + goal allocation |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Database | PostgreSQL via Neon (serverless) |
| ORM | Prisma 6 |
| State Management | Zustand (`store/useAppStore.ts`, `useShiftsStore.ts`, `useJobsStore.ts`, `useTemplatesStore.ts`, `useExpensesStore.ts`, `useBudgetStore.ts`) |
| Email | Resend |
| Notifications | Sonner |
| Auth | Custom session-based (bcrypt + SHA-256 tokens) |
| Fonts | Syne (display) · JetBrains Mono (mono) |
| Styling | Vanilla CSS with CSS variables |

---

## Project Structure

```
bow-nextjs/
├── app/
│   ├── layout.tsx                # Root layout — fonts, metadata, global Toaster
│   ├── globals.css               # CSS design tokens & base styles
│   ├── globals.css
│   ├── auth/actions.ts           # register, login, forgot/reset password, verify
│   ├── actions/
│   │   ├── account.ts            # updateAccount, resendVerificationEmail
│   │   ├── shifts.ts             # shift CRUD + recompute
│   │   ├── jobs.ts               # job CRUD + default-job seeding
│   │   ├── templates.ts          # template CRUD
│   │   ├── expenses.ts           # category & expense CRUD
│   │   └── budget.ts             # notes + goals CRUD (Phase 3)
│   ├── dashboard/page.tsx        # Protected dashboard (requires login)
│   ├── login/                    # Login page
│   ├── register/                 # Registration page
│   ├── verify/                   # "Check your email" page with resend form
│   ├── verify-email/route.ts     # GET handler for email token validation
│   ├── forgot-password/          # Forgot password page
│   └── reset-password/           # Reset password page
├── components/
│   ├── layout/                   # AppShell, Topbar, TopTabs, BottomNav
│   ├── auth/                     # LoginForm, RegisterForm, AuthShell, ResendVerificationForm
│   ├── account/                  # AccountView — profile & verification UI
│   ├── calendar/                 # CalendarView, CalendarCell, CalendarGrid, VisaBar, Month/WeekSummary
│   ├── budget/                   # BudgetView, BudgetGoalCard, ExpenseEntryForm
│   ├── summary/                  # SummaryView, cumulative earnings stats
│   ├── transactions/             # TransactionsView
│   ├── templates/                # TemplatesView, TemplateCard, TemplateFormModal, ApplyTemplateModal
│   ├── settings/                 # SettingsView (export/import, toggles)
│   ├── modals/                   # DayModal, JobManagerModal, VisaWarningModal
│   ├── fab/                      # FABButton, FABMenu, 4 quick-entry modals
│   └── ui/                       # Modal, ProgressBar, ToggleSwitch, Field, Button, StatusBadge
├── store/                        # Zustand stores (DB-backed where applicable)
│   ├── useAppStore.ts            # Active tab, open-modal, per-minute toggle
│   ├── useShiftsStore.ts         # UserShift cache (`wh_shifts` Zustand mirror)
│   ├── useJobsStore.ts           # UserJob cache (no localStorage round-trip)
│   ├── useTemplatesStore.ts      # UserTemplate cache
│   ├── useExpensesStore.ts       # UserExpenseCategory + UserExpense cache
│   └── useBudgetStore.ts         # Per-month notes + cross-month goals hydrate-on-demand
├── lib/
│   ├── auth/                     # session.ts, prisma.ts, email templates
│   ├── dateUtils.ts              # monthKey, navigateMonth, dateKey, parseMonthKey
│   ├── dayHours.ts               # getDayHours / getNightHours (shifts-store bridge)
│   ├── nightPayEngine.ts         # minute-by-minute night-pay calculator
│   └── timeUtils.ts
├── prisma/schema.prisma          # 11 models (User … UserBudgetGoal)
├── services/                     # exportService.ts, importService.ts (DB roundtrips)
└── types/index.ts                # Shared TypeScript interfaces
```

---

## v6.3 → v6.4 Migration Notes

The full migration log lives in `BOW_NEXTJS_MIGRATION.md` (rewritten for v6.4). Quick recap:

| Phase | Commit | What changed |
|-------|--------|--------------|
| 0 | `4f26f7c` | Tooling + `.npmrc` (Windows `omit=dev` shadowing), Prisma 6 JsonNull types, per-minute server wiring |
| 1 | `4e48c8a` | Shifts DB-backed — `UserShift` rows are canonical; `wh2_*`/`wh2n_*` localStorage keys deleted |
| 2A-2B | `2f5ddff`, `22d3258` | Jobs DB-backed — `UserJob` replaces `wh_jobs3`; `JobManagerModal` async save |
| 2E | `22d3258` | Export/Import re-routed to DB roundtrips; `services/storage.ts` shrunk to a 27-line bridge |
| 3A-3F | `61d00e2` | Budget scaffolding DB-backed — `UserBudgetMonthMeta` (notes) + `UserBudgetGoal` (cross-month); `useBudgetStore` no longer persists |
| 5A | `c26c757` | `services/storage.ts` deleted; day-hours bridge relocated to `lib/dayHours.ts` |

**Net result on `localStorage`:**
- ✘ `wh_jobs3` — gone
- ✘ `wh_categories` — gone
- ✘ `wh_budgets` — gone
- ✘ `wh_perMinute` — gone
- ✘ `wh2_*` / `wh2n_*` (per-day hours cache) — gone
- ✘ `wh_templates` — gone
- ◘ `wh_shifts` — **kept** (ZUSTAND mirror only; truth lives in `UserShift`)
- ◘ `bow_session` — auth cookie (not a data cache)

If a pre-v6.4 user signs in and has stale keys in DevTools, they are no-ops — no code path reads them. Safe to clear from browser settings.
