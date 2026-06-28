# BOW Project Memory (June 2026)

## Project Name

BOW (Budget + Shift + Earnings Tracker)

---

# Purpose

BOW is a mobile-first personal productivity and finance application designed primarily for students and part-time workers in Japan.

The application combines:

* Shift Tracking
* Earnings Tracking
* Actual Work Time Tracking
* Budget Management
* Expense Tracking
* Template Management
* Monthly Financial Planning

The goal is to manage work schedules, income, expenses, savings goals, and monthly budgeting in a single application.

---

# Original Architecture

The project originally started as:

```text
Single HTML File
≈2500+ lines
```

Technology:

* HTML
* CSS
* Vanilla JavaScript
* LocalStorage

Problems:

* Too large
* Difficult to maintain
* Difficult for AI tools to modify
* High risk of merge conflicts

---

# Refactoring History

Phase 1:

Split giant HTML file into:

```text
assets/
├── css/
├── js/
└── index.html
```

Phase 2:

Split JavaScript into modular files.

Current modular architecture:

```text
assets/
├── css/
│   ├── style.css
│   ├── fab.css
│   ├── modal.css
│   └── forms.css
│
└── js/
    ├── app.js
    ├── modal.js
    ├── fab.js
    ├── expense-entry.js
    ├── shift-entry.js
    ├── actual-time.js
    ├── template-entry.js
    │
    └── modules/
        ├── storage.js
        ├── calculations.js
        ├── calendar.js
        ├── day-modal.js
        ├── job-manager.js
        ├── shift-form.js
        ├── templates.js
        ├── export-import.js
        ├── navigation.js
        ├── budget.js
        ├── transactions.js
        └── dev-story.js
```

---

# Current UI Structure

## Top Tabs

* Calendar
* Templates
* Budget
* Summary
* Settings

---

## Bottom Navigation

Includes:

* Transactions
* Statistics
* Accounts
* More

Implementation may evolve.

---

## Floating Action Button (FAB)

Purpose:

Quick Entry System

Actions:

* Add Expense
* Add Shift
* Add Actual Time
* Create Template

Originally inspired by modern finance apps.

FAB should:

* Not cover bottom navigation
* Not cover weekly progress bars
* Have scroll-safe spacing
* Be mobile friendly

---

# Calendar System

Core feature.

Each day may contain:

* Scheduled Shift
* Actual Shift
* Earnings
* Hours
* Notes

Month navigation supported.

Swipe navigation supported.

---

# Shift System

User can:

* Create Shift
* Edit Shift
* Delete Shift

Fields include:

* Date
* Job
* Start Time
* End Time
* Break Time
* Notes

---

# Actual Time Tracking

Purpose:

Compare scheduled time vs actual worked time.

Fields:

* Actual Login Time
* Actual Logout Time
* Actual Breaks

Used for:

* Actual hours
* Actual earnings
* Overtime calculations

Module:

```text
actual-time.js
```

Important:

ActualTime must only be declared once.

Previous bug:

Duplicate ActualTime declaration caused:

```javascript
Identifier 'ActualTime' has already been declared
```

Resolved.

---

# Templates

Purpose:

Quickly populate future shifts.

User can:

* Create Template
* Apply Template
* Edit Template
* Delete Template

---

# Budget System

Budget is monthly.

Concept:

Income acts as source bucket.

Money flows into categories based on priority.

Inspired by bucket allocation systems.

Example:

Income
↓
Rent
↓
Food
↓
Transport
↓
Savings
↓
Entertainment

Features:

* Category priorities
* Reordering categories
* Goal tracking
* Monthly budgeting

Important:

Budget is currently largest module.

```text
budget.js
≈600 lines
```

Potential future split:

```text
budget/
├── budget-render
├── budget-goals
├── budget-categories
└── budget-calculations
```

---

# Transactions

Tracks:

* Income
* Expenses

Expense fields:

* Date
* Time
* Category
* Account
* Amount
* Notes

Default behavior:

Current date/time auto-filled.

---

# Job Manager

User may have multiple jobs.

Each job contains:

* Name
* Hourly Wage
* Color
* Settings

Used for:

* Earnings calculations
* Shift rendering

---

# Data Storage

Current (v6.4):

```text
Neon Postgres (Prisma 6) — source of truth
ZUSTAND `wh_shifts` cache mirror (instant calendar paint only)
```

All user data persists server-side via the `app/actions/*` server actions.

Models:

* `User` — account + prefs
* `UserShift` — daily shifts (canonical source for hours; day-totals derived in-memory)
* `UserJob` — per-user jobs
* `UserTemplate` — reusable shift templates
* `UserExpenseCategory` / `UserExpense` — budget categories + per-month expenses
* `UserBudgetMonthMeta` — per (user, monthKey) free-form notes
* `UserBudgetGoal` — cross-month savings goals (JSON `monthlyProgress` carries per-month allocations)

If a stale `wh_jobs3` / `wh_budgets` / `wh_perMinute` / `wh_categories` key is still in browser DevTools it is dead weight — no v6.4 code reads them.

---

# Import / Export

Supported.

Purpose:

Operator-side portability (DB → JSON for backup / migration).

Driven by `services/exportService.ts` (reads DB-backed stores) and `services/importService.ts` (parses JSON → calls the same DB server actions as the app).

Modes:

* `replace` — wipes & recreates from backup
* `merge` — except default jobs/categories, dedup by id

---

# Hosting

Current:

```text
GitHub Pages
```

Repository:

bow-app

Hosted as static site.

---

# Future Direction

Current migration target:

```text
Next.js
TypeScript
Tailwind CSS
```

Potential future stack:

```text
Next.js
TypeScript
Tailwind
Zustand
IndexedDB
```

Cloud version:

```text
Next.js
Supabase
PostgreSQL
Google Login
```

---

# Current Next.js Migration Status

Migration to Next.js 16 complete. All localStorage round-trips gone except the `wh_shifts` Zustand mirror:

| Phase | Outcome |
|---|---|
| 0 (tooling + JSON types) | `.npmrc` fix, Prisma 6 JsonNull migration, per-minute wired to server |
| 1 (shifts) | `wh_shifts` → Neon `UserShift` rows |
| 2 (jobs) | `wh_jobs3` → Neon `UserJob` rows |
| 2E (export/import) | `services/storage.ts` shrunk to a 27-line bridge; `services/importService.ts` rewired to call server actions |
| 3 (budget scaffolding) | `wh_budgets` → `UserBudgetMonthMeta` + `UserBudgetGoal` |
| 5A/5B (cleanup) | `services/storage.ts` deleted; `lib/dayHours.ts` is the only day-hours bridge |

Last 7 commits on `arockia/V7-nextjs-migration`:

```
c26c757 feat(refactor): relocate day-hours bridge into lib/dayHours (drop services/)
61d00e2 feat(budget): DB-backed useBudgetStore + Goal CRUD (kills wh_budgets)
22d3258 feat(jobs): DB-backed useJobsStore + JobManagerModal async save (kills wh_jobs3)
2f5ddff feat(jobs): add UserJob Prisma model + jobs action server module
4e48c8a feat(shifts): derive per-(day,job) hours from DB-backed shifts map (kills wh2_*/wh2n_* localStorage)
4f26f7c chore: tooling/pinning — gitignore .hermes/, npmrc fix, package overrides + lockfile
bbb6e68 fix(server): Prisma 6 JsonNull/InputJsonValue types in shifts.ts (Bug 2)
```

Current `next.config.ts`: Turbopack-default (no static export — Prisma needs the Node runtime).

---

# Development Rules

1. Mobile-first design.
2. Do not break LocalStorage compatibility unless migration is provided.
3. Budget logic is core functionality.
4. Shift tracking is core functionality.
5. Expense tracking is core functionality.
6. Keep modules focused.
7. Avoid giant files.
8. Avoid circular dependencies.
9. Prefer reusable components.
10. Preserve Git history through incremental commits.

---

# Known Past Issues

* Duplicate ActualTime declarations.
* Circular dependency between budget.js and transactions.js.
* Incorrect script loading order.
* 404 asset loading issues.
* assets/assets path mistakes.
* FAB overlapping content.
* Giant monolithic app.js.

All were resolved during refactoring.

---

# Long-Term Vision

BOW should eventually become:

* Offline-first
* Mobile-first
* PWA installable app
* Cloud-sync capable
* Multi-user capable
* Google login capable
* Cross-device capable

while remaining free or extremely low-cost to host.
