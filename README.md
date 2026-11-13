# realestateleadcaller — "Jules" AI Real Estate Concierge

An AI concierge that automatically contacts, qualifies, nurtures, and warm-transfers real estate leads. Dashboard, lead management, a state-machine workflow engine, an AI script engine, warm transfers, and direct mail — built as part of the RealEstateCRM project family for Excel Legacy Realty Group.

## Status

**Active development (maintenance).** Version 0.6.1 (per `VERSION.md` and `package.json`). Last commit 2026-11-12 (org transfer to RealEstateCRMLLC, dev port moved to 3008, Turbopack workspace-root fix for CI). The most recent feature work was June–July 2026 (Phases 21–27: geocoding, direct mail, native calling, lead scoring, SSE map updates); Oct 2026 brought webhook and JSON-parse fixes.

**Important:** this repo's code was merged into [leadG](https://github.com/RealEstateCRMLLC/leadG) in Sep 2026 (leadG v2.0.0, "Jules AI Real Estate Concierge" merge — 27 phases). The features below now live in both repos. This repo is still maintained separately (it is a submodule of the main CRM and is built by its CI), but leadG is the unified home for the concierge features.

## What it does

1. **Dashboard** — Centralized view of lead statistics and overdue follow-ups
2. **Lead management** — View all leads, add new leads, detailed lead profiles with communication history and AI summaries
3. **Workflow engine** — Automated state machine (triggered via `/api/engine/tick`) that processes leads through structured follow-up sequences (e.g. "Buyer 10-Day Blitz")
4. **AI script engine** — Compiles dynamic conversation scripts based on lead data
5. **Warm transfers** — Qualify a lead and bridge them to a human agent, with an AI summary of the conversation; native in-browser calling via `@twilio/voice-sdk` (floating dialer)
6. **Direct mail** — UI and API for generating and tracking direct mail tasks (Lob, dispatched via Inngest background jobs)
7. **Geospatial** — Nominatim geocoding on lead creation/import; Circle Prospecting map with SSE real-time updates
8. **Lead scoring** — ML-predictive scoring across the lead pool (Inngest batch job), with a dashboard "Re-Score" trigger
9. **Notifications** — Global banner polling for webhook-triggered events

## Architecture

- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind
- **Backend:** Next.js API Routes
- **Database:** SQLite via Prisma ORM
- **Adapters:** A modular adapter pattern (`src/lib/adapters`) for external communications (Voice, SMS, Email, CRM, Direct Mail, Calendar, Social Messaging). The MVP phase used mocks; live adapters for Twilio/SendGrid/Vapi and Inngest background queues have since been wired in (see the changelog and Oct 2026 commits).
- **Auth:** NextAuth
- **MCP:** Model Context Protocol SDK included

## What's working / what's not

- The dashboard, lead management, workflow engine, script engine, warm transfers, direct mail, geocoding, scoring, and notifications are implemented, per the changelog (v0.2.0–0.6.0) and the Oct 2026 fixes.
- No production deployment is documented in this repo — `DEPLOY.md` exists and the app is containerized (Dockerfile + docker-compose), but there is no live URL, uptime, or user evidence in the repo itself. The app is built by the main RealEstateCRM repo's CI (leadcaller job), which was green as of Nov 12, 2026 (RealEstateCRM v0.63.6). Locally it runs on port 3008.
- Housekeeping: `prisma/dev.db` (a SQLite database) is tracked in the repo (per the v0.6.1 commit) — worth revisiting if it ever holds real data. The `CHANGELOG.md` ends at v0.6.0 (2026-07-03); v0.6.1 is not documented there.
- Live-service behavior (real calls, real SMS/email, real mail) depends on API keys configured via `.env` — no evidence in the repo that the full chain has run end-to-end against live services.

## Relationship to RealEstateCRM

This is a satellite service of [RealEstateCRM](https://github.com/RealEstateCRMLLC/RealEstateCRM) — the AI concierge / lead-calling workflow that complements the main CRM. It is a separate service, not part of the main CRM codebase. Its features were merged into [leadG](https://github.com/RealEstateCRMLLC/leadG) (v2.0.0, Sep 2026), which is the unified voice + concierge platform.

## Running it

1. Install dependencies: `npm install`
2. Copy the example environment file: `cp .env.example .env`
3. Initialize the database: `npx prisma db push` (then seed workflows per `prisma/seed.ts`)
4. Run the dev server: `npm run dev` (port 3008)
5. Open http://localhost:3008 in your browser

To simulate the background cron job that processes automated follow-ups, click **"Run Workflow Engine"** on the dashboard, or `curl -X POST http://localhost:3008/api/engine/tick`.

See `DEPLOY.md` and `HANDOFF.md` for deployment and architectural notes.

## Links

- Main CRM: https://github.com/RealEstateCRMLLC/RealEstateCRM
- Unified voice + concierge (leadG): https://github.com/RealEstateCRMLLC/leadG
- Org: https://github.com/RealEstateCRMLLC
