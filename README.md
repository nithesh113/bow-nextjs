# BOW — Japan Work Hours & Budget Tracker (Next.js)

**Version:** 6.4 | **Framework:** Next.js 14 + TypeScript + Zustand + PostgreSQL (Neon)

---

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Fill in DATABASE_URL, RESEND_API_KEY, APP_URL, EMAIL_FROM

# Push database schema
npm run prisma:push

# Generate Prisma client
npm run prisma:generate

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
bow-nextjs/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout (fonts, metadata, Toaster)
│   ├── page.tsx            # Main entry
│   ├── globals.css         # CSS variables, base styles
│   ├── auth/               # Server actions (login, register, reset, verify)
│   ├── actions/            # Account server actions
│   ├── dashboard/          # Protected dashboard page
│   ├── login/              # Login page
│   ├── register/           # Register page
│   ├── verify/             # Email verification page (with resend form)
│   ├── verify-email/       # Token verification API route
│   ├── forgot-password/    # Forgot password page
│   └── reset-password/     # Reset password page
├── components/
│   ├── layout/             # AppShell, Topbar, TopTabs, BottomNav
│   ├── auth/               # LoginForm, RegisterForm, ResendVerificationForm
│   ├── account/            # AccountView (editable profile)
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
├── lib/
│   ├── auth/               # session, prisma, email templates (verify, welcome, reset)
│   └── ...                 # dateUtils, timeUtils, nightPayEngine
├── prisma/
│   └── schema.prisma       # Database schema
├── services/               # Storage, export, import
├── hooks/                  # useLocalStorage, useSwipeGesture, useModal
└── types/                  # TypeScript interfaces
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
- ✅ User accounts with PostgreSQL persistence (Neon)
- ✅ Email verification on registration (via Resend)
- ✅ Resend verification email with toast notifications
- ✅ Password reset via email
- ✅ Editable account profile (name, email, currency, location)
- ✅ Dark theme, mobile-first

---

## Authentication Flow

| Step | Description |
|------|-------------|
| Register | Creates account → sends verification email → redirects to `/verify` |
| Verify Email | User clicks link → token validated → session created → redirected to dashboard |
| Resend | User requests new link from `/verify` page with sonner toast feedback |
| Login | Email + password → session → dashboard |
| Forgot Password | Email link → `/reset-password?token=...` → new password |
| Dashboard Guard | Unverified users are bounced to `/verify?email=...` |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (Neon) |
| `RESEND_API_KEY` | Resend API key for transactional emails |
| `APP_URL` | App base URL (e.g. `http://localhost:3000`) |
| `EMAIL_FROM` | Sender address (e.g. `BOW <noreply@yourdomain.com>`) |
| `AUTH_COOKIE_NAME` | Session cookie name (default: `bow_session`) |

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

## Database (Prisma + Neon PostgreSQL)

```bash
# Apply schema changes to database
npm run prisma:push

# Regenerate Prisma Client types (stop dev server first on Windows)
npm run prisma:generate
```

> **Note for Windows users:** Stop `npm run dev` before running `prisma:generate` to avoid file-lock errors.

---

## Prisma Models

| Model | Purpose |
|-------|---------|
| `User` | Account with name, email, passwordHash, currency, location, emailVerified |
| `Session` | Auth sessions linked to user |
| `VerificationToken` | Email verification tokens (24h expiry) |
| `PasswordResetToken` | Password reset tokens (1h expiry) |
