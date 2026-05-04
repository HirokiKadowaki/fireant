# FireAnt

Personal FIRE (Financial Independence, Retire Early) tracker, built for Japan-specific scenarios.

Tracks monthly expenses, income, account balances, and liabilities, then projects your FIRE date using configurable safe withdrawal rate, expected return, and pension assumptions. Includes Japan-specific features: 確定拠出年金 lockup-until-60 bridge analysis, 厚生年金 pension top-up at 65, NISA / 特定口座 account types, and JPY-everywhere display.

Built as a personal learning project to replace a Google Sheets workflow.

## Features

- Monthly snapshot entry with auto-save and inline formula evaluation (`1500+800+450` → 2750)
- Three-scenario FIRE projection (conservative / expected / optimistic real returns)
- Bridge analysis for funds locked in 確定拠出年金 until age 60
- Coast FIRE calculation
- Mortgage amortization with separate original / current balance tracking
- History page with trend charts and CSV export
- Privacy mode toggle for screen-sharing
- Stale-data nudge when monthly entry is overdue
- Mobile-optimized PWA: installable, fullscreen launch
- v2: AI-powered monthly insights via Claude API. Server-side route generates a 2-3 sentence summary comparing the latest month to baseline, cached in the database

## Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS
- **Database:** Supabase (Postgres with Row-Level Security)
- **Auth:** Supabase Auth (email + password)
- **Hosting:** Vercel with auto-deploy on push
- v2: **AI:** Anthropic Claude API (Sonnet 4.6) for monthly insight generation

## Architecture notes

- **Single-user design** with full RLS isolation per account
- **Monthly snapshots, not transaction-level**
- **Real returns and inflation-adjusted projections** throughout
- **Source-of-truth data model** Store birth date and compute age, store original principal and current balance separately, etc.

## Local development

1. Clone this repo
2. Set up a Supabase project, run `schema.sql` in the SQL Editor
3. `cp .env.local.example .env.local` and fill in your Supabase URL, Supabase anon key, and Anthropic API key
4. `npm install`
5. `npm run dev`
6. Open `http://localhost:3000`

## Status

Personal project. v1 complete. Not actively seeking contributors but happy to discuss the design — open an issue.
v2: Added AI-powered summary with Claude
