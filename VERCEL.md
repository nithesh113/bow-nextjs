# BOW — Vercel Deployment Guide

One-time setup, then iterative deploys.

## Prerequisites

- A Vercel account (free tier works)
- A Neon project with the schema already pushed — see `prisma:push` script
- An SMTP provider for auth emails (Gmail app passwords work for low-volume testing)
- This repo's branch pushed to its remote (e.g. `arockia/V7-nextjs-migration`)

## Step 1 — Push schema to production Neon

```bash
# From your laptop, against the prod-Neon DATABASE_URL:
cross-env DATABASE_URL=postgresql://...prod neondb npm run prisma:push
# or
$env:DATABASE_URL = 'postgresql://...prod'; npm run prisma:push
```

This creates all eleven tables on the production instance. Re-runs are idempotent.

## Step 2 — Import the Vercel project

1. https://vercel.com/new → **Import Git Repository** → select your fork
2. **Framework Preset**: Next.js (auto-detected)
3. **Root Directory**: `./` (the project is a single Next.js app)
4. **Build & Output settings** → leave defaults; `vercel.json` overrides:
   - `buildCommand`: `prisma generate && next build`
   - `installCommand`: `npm install --legacy-peer-deps`
   - `regions`: `sin1` (Singapore; override for Japan → `hnd1` if Vercel supports it)
5. **Environment Variables** — set these (the project's `process.env` lookups):

| Variable                              | Required | Notes                                                |
| ------------------------------------- | -------- | ---------------------------------------------------- |
| `DATABASE_URL`                        | ✅        | Full Postgres URL with `?sslmode=require`            |
| `SMTP_HOST`                           | ⚙️        | For Gmail auth emails: `smtp.gmail.com`              |
| `SMTP_PORT`                           | ⚙️        | `587` (TLS) or `465` (implicit)                      |
| `SMTP_USER`                           | ⚙️        | Sender address (Gmail users: the full email)         |
| `SMTP_PASS`                           | ⚙️        | App Password, not the account password                |
| `EMAIL_FROM`                          | ⚙️        | `"BOW <your@gmail>"` — shown to users                |
| `APP_URL`                             | ✅        | `https://bow-<owner>.vercel.app` (no trailing slash)  — used in password-reset and verify-email links |
| `AUTH_COOKIE_NAME`                    | ⚙️        | Defaults to `bow_session`                             |

> Mark each as **Production**, **Preview**, **Development** scope as needed. `DATABASE_URL` and `APP_URL` MUST be Production-only for prod-Neon separation.

6. **Deploy**. First push takes ~2–3 minutes (Next 16 + Prisma generate + Turbopack build).

## Step 3 — First-deploy verification

Once deployed:

1. Visit the URL Vercel gave you (`https://bow-…vercel.app`).
2. **Register** an account — that exercises `User`, `Session`, `VerificationToken`.
3. Check the email inbox (or Resend/SMTP logs at `https://resend.com/emails`).
4. Click the verify link → `/verify-email?token=…` → lands you on `/dashboard`.
5. **Add a job** — exercises `UserJob`.
6. **Log a shift** — exercises `UserShift`.
7. Switch to **Budget tab**, add a goal — exercises `UserBudgetGoal`.
8. **Settings → Export backup (JSON or CSV)** — verifies `fetchBackupBundle` server action works in the prod env.

If anything errors, check **Vercel → Logs → Functions**. Most failures will be SMTP auth or wrong `DATABASE_URL` `sslmode`.

## Step 4 — Custom domain

Vercel → Settings → Domains → add your domain (e.g. `bow.yourdomain.com`). Update `APP_URL` in env vars to the canonical URL. Re-deploy (env-var change re-triggers).

## Troubleshooting

| Symptom                                                         | Likely cause                                              |
| --------------------------------------------------------------- | --------------------------------------------------------- |
| Build hangs at `prisma generate`                                | Schema syntax error — run `npm run prisma:generate` locally first |
| `P1001: Can't reach database`                                   | Wrong `DATABASE_URL` or Neon region firewall              |
| Email never arrives                                             | SMTP `secure` flag mismatch (try 465 vs 587)              |
| Verify link 404s                                                | Wrong `APP_URL` — must match deployed URL exactly         |
| `cookies I/O errors` in logs                                    | `AUTH_COOKIE_NAME` is missing (defaults to `bow_session`) |
| Re-deploy needed? Env-var change counts — Vercel redeploys automatically      |

## Database migrations

This project uses Prisma's `db push` (no migration history). When adding new schema:

```bash
npm run prisma:push   # local + dev DB
# then trigger Vercel production DB:
# either run with prod DATABASE_URL locally, or use Neon's branching for prod-previews
```

For row-level changes that need data backfill (column renames, RLS changes), do them in `seed`/a CLI script you run against Neon directly.

## Local sanity before deploy

```bash
npm run build    # Vercel-compatible build flow (no realpath patch)
npm run build:win  # Windows with the realpath patch
npm run type-check
```

If `npm run build` fails locally it will fail in Vercel too. Fix root cause first.

## Why `legacy-peer-deps=true`?

The repo ships `.npmrc` with `legacy-peer-deps=true`, `production=false`, `include=dev`. Global npm config on some setups shadows these — Vercel overrides npm config logically with CLI flags (we pass `--legacy-peer-deps` in `installCommand` to be sure).
