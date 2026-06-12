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

Current:

```text
LocalStorage
```

All user data stored locally.

Includes:

* Shifts
* Jobs
* Templates
* Budgets
* Transactions
* Settings

---

# Import / Export

Supported.

Purpose:

Manual backup.

JSON format.

Used because app currently has no backend.

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

Claude generated a Next.js version.

Initial issue:

```text
next.config.ts not supported
```

Resolved by replacing with:

```text
next.config.mjs
```

Example:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
```

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
