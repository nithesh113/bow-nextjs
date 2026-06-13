# BOW — Japan Work Hours & Budget Tracker

**Version:** 6.4 | **Stack:** Next.js 14 · TypeScript · Zustand · PostgreSQL (Neon) · Prisma · Resend · Sonner

> Budget + Overtime + Work tracker for Japan international students on a student visa. Tracks your 28h/week work limit, night-pay premiums, budget allocations, and savings goals — all from a mobile-first dark-mode app.

---

## Quick Start

```bash
# 1. Install dependencies
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

---

## Features

### 🔐 Authentication & Accounts
- Secure registration with **email verification** (via Resend)
- Login with email + password (bcrypt hashed, session-based)
- **Forgot password** — email reset link with 1-hour expiry
- **Resend verification email** — from the `/verify` page or Account page
- Verification status banner & badge in the Account page
- Persistent sessions via HTTP-only cookies (30-day expiry)

### 👤 Account Management
- Editable profile: **name**, **email**, **currency**, **location**
- Per-user **currency selector** (JPY, USD, EUR, GBP, INR, AUD, CAD)
- Per-user **location selector** (Japan, US, UK, India, Australia, etc.)
- Sonner toast notifications for all save/error events
- Email verification badge: ✅ verified with date, or ⚠️ unverified with resend button

### 📅 Work Calendar
- Monthly calendar with per-day shift tracking
- Japan student visa **28h/week compliance tracker** with colour-coded VisaBar
- **Scheduled vs Actual** hours comparison per day
- Support for multiple jobs per day

### 💰 Budget & Finance
- Monthly budget with **waterfall allocation** across categories
- **Savings goals** with carry-forward from previous months
- Budget categories with colour coding and progress tracking

### 🧾 Transactions
- Log work shifts, expenses, and actual pay
- View and filter all financial transactions

### 🌙 Night Pay Engine
- Automatic **night-pay premium** calculation for hours between 22:00–05:00
- Per-minute pay toggle for granular calculations

### 📋 Templates
- Create reusable shift templates for recurring work patterns
- Apply templates directly from the calendar via a bottom-sheet modal

### ⚡ FAB Quick Entry
- Floating Action Button with 4 fast-entry modes:
  - Add Expense
  - Log Shift
  - Log Actual Time
  - Apply Template

### 💾 Backup & Restore
- Full JSON **export** of all local data
- **Import** from a previous JSON backup
- All work/budget data stored in `localStorage` (per-device)

### 🎨 UI & Design
- **Dark theme** with CSS variables design system
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
| `APP_URL` | ✅ | Base URL (e.g. `http://localhost:3000`) |
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

> **Prisma + Neon PostgreSQL**

```bash
# Apply schema changes to the database
npm run prisma:push

# Regenerate Prisma Client types
# ⚠️ Windows: stop `npm run dev` first to avoid EPERM file-lock errors
npm run prisma:generate
```

| Model | Purpose |
|-------|---------|
| `User` | Account: name, email, passwordHash, currency, location, emailVerified |
| `Session` | Active login sessions (tokenHash, expiresAt) |
| `VerificationToken` | Email verification tokens — 24h expiry |
| `PasswordResetToken` | Password reset tokens — 1h expiry, single-use |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL via Neon (serverless) |
| ORM | Prisma 6 |
| State Management | Zustand |
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
│   ├── layout.tsx              # Root layout — fonts, metadata, global Toaster
│   ├── globals.css             # CSS design tokens & base styles
│   ├── auth/actions.ts         # Server actions: register, login, forgot/reset password, verify
│   ├── actions/account.ts      # Server actions: updateAccount, resendVerificationEmail
│   ├── dashboard/page.tsx      # Protected dashboard (requires login)
│   ├── login/                  # Login page
│   ├── register/               # Registration page
│   ├── verify/                 # "Check your email" page with resend form
│   ├── verify-email/route.ts   # GET handler for email token validation
│   ├── forgot-password/        # Forgot password page
│   └── reset-password/         # Reset password page
├── components/
│   ├── layout/                 # AppShell, Topbar, TopTabs, BottomNav
│   ├── auth/                   # LoginForm, RegisterForm, AuthShell, ResendVerificationForm
│   ├── account/                # AccountView — redesigned profile & verification UI
│   ├── calendar/               # CalendarView, CalendarCell, VisaBar
│   ├── budget/                 # BudgetView, CategoryCard, GoalCard
│   ├── summary/                # SummaryView, cumulative earnings stats
│   ├── transactions/           # TransactionsView
│   ├── templates/              # TemplatesView, TemplateCard, ApplyModal
│   ├── settings/               # SettingsView (export/import, toggles)
│   ├── modals/                 # DayModal, JobManagerModal, and other modals
│   ├── fab/                    # FABButton, FABMenu, 4 quick-entry modals
│   └── ui/                     # Modal, ProgressBar, ToggleSwitch, Field, Button, etc.
├── store/                      # Zustand: jobs, shifts, templates, budget, app state
├── lib/
│   ├── auth/                   # session.ts, prisma.ts, email templates
│   ├── dateUtils.ts
│   ├── timeUtils.ts
│   └── nightPayEngine.ts
├── prisma/schema.prisma        # Prisma schema
├── services/                   # localStorage storage, JSON export/import
├── hooks/                      # useLocalStorage, useSwipeGesture, useModal
└── types/index.ts              # Shared TypeScript interfaces
```
