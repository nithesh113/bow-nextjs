# BOW — Japan Work Hours & Budget Tracker (Next.js)

**Version:** 6.3 | **Framework:** Next.js 14 + TypeScript + Zustand

---

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production (static export for GitHub Pages)
npm run build
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
bow-nextjs/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout (fonts, metadata)
│   ├── page.tsx            # Main entry (CSR only)
│   └── globals.css         # CSS variables, base styles
├── components/
│   ├── layout/             # AppShell, Topbar, TopTabs, BottomNav
│   ├── calendar/           # CalendarView, CalendarCell, VisaBar
│   ├── modals/             # DayModal, JobManagerModal, etc.
│   ├── templates/          # TemplatesView, TemplateCard, ApplyModal
│   ├── budget/             # BudgetView, CategoryCard, GoalCard
│   ├── summary/            # SummaryView, cumulative stats
│   ├── settings/           # SettingsView
│   ├── transactions/       # TransactionsView
│   ├── fab/                # FABButton, FABMenu, 4 entry modals
│   └── ui/                 # Modal, ProgressBar, ToggleSwitch, etc.
├── store/                  # Zustand stores (jobs, shifts, templates, budget, app)
├── lib/                    # Pure utilities (dateUtils, timeUtils, nightPayEngine)
├── services/               # Storage, export, import
├── hooks/                  # useLocalStorage, useSwipeGesture, useModal
├── types/                  # TypeScript interfaces
└── public/                 # manifest.json
```

---

## Key Features

- ✅ Japan student visa 28h/week compliance tracker
- ✅ Night pay calculation (22:00–05:00 premium rate)
- ✅ Scheduled vs Actual time comparison
- ✅ Monthly budget with waterfall allocation
- ✅ Savings goals with carry-forward
- ✅ Template system for recurring shifts
- ✅ FAB quick entry (expense, shift, actual time, template)
- ✅ Full JSON backup / restore
- ✅ 100% offline — no server, no accounts
- ✅ Dark theme, mobile-first

---

## Business Rules

| Rule | Detail |
|------|--------|
| Week limit | 28 hours Mon–Sun |
| Night pay | 22:00–05:00 premium rate |
| Date range | Apr 2026 – Sep 2027 (18 months) |
| School fee target | ¥840,000 |
| Week start | Monday |

---

## Deploy to GitHub Pages

```bash
npm run build
# Uploads the `out/` folder to GitHub Pages
```

Set `output: 'export'` is already configured in `next.config.ts`.

---

## localStorage Keys

| Key | Purpose |
|-----|---------|
| `wh_jobs3` | Jobs array |
| `wh_shifts` | Shifts per date |
| `wh_templates` | Templates array |
| `wh_perMinute` | Per-minute pay toggle |
| `wh_budgets` | Monthly budgets |
| `wh2_{date}_{jobId}` | Hours cache per day |
| `wh2n_{date}_{jobId}` | Night hours cache |
