# PropertyVision

PropertyVision is the umbrella brand for land-intelligence products in this repository:

- **Parcelis** (`/parcelis`) — Real-estate parcel analysis, home-model fit, and property intelligence APIs under `/api/parcelis/*`.
- **Fieldstone** (`/fieldstone`) — Agricultural land analytics (layers, scenarios, portfolio) with APIs under `/api/fieldstone/*`.
- **ConflictLens** (`/conflict`) — Country risk heat map, travel-advisory–weighted scores, news/social signals (requires Supabase — see below).

Legacy URLs `/house-ai`, `/agrimap`, and their `/api/house-ai/*`, `/api/agrimap/*` paths redirect to the Parcelis and Fieldstone routes.

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

If you removed `node_modules` to free disk space, run `npm install` again before `npm run dev`.

Open [http://localhost:3000](http://localhost:3000) to choose a workspace.

## Stack

This is a [Next.js](https://nextjs.org) application (App Router). See `package.json` for scripts and dependencies.

## Database

Optional Supabase/PostGIS schema for grid and parcel data — plus the **ConflictLens** tables — live in [`supabase/schema.sql`](supabase/schema.sql).

**Security advisor / linter:** [`supabase/security-advisor-fixes.sql`](supabase/security-advisor-fixes.sql) updates the ConflictLens view (`latest_conflict_scores`) for Postgres `security_invoker` and is safe to run in the SQL Editor. PostGIS’s `spatial_ref_sys` table is not altered there—RLS on that catalog table requires database-owner privileges; many projects ignore that finding or apply [`supabase/spatial-ref-sys-rls-optional.sql`](supabase/spatial-ref-sys-rls-optional.sql) only via a **postgres** connection (see comments in that file).

### ConflictLens (required for `/conflict`)

1. **Apply SQL** — In the Supabase SQL editor, run [`supabase/conflictlens.sql`](supabase/conflictlens.sql) (standalone ConflictLens DDL only), or the full [`supabase/schema.sql`](supabase/schema.sql). After Run, open **Settings → API → reload schema** (or wait ~1 minute). This creates `countries`, `travel_advisories`, `news_articles`, `social_signals`, `conflict_risk_scores`, and the `latest_conflict_scores` view.

2. **Environment variables** (`.env.local`):

   - `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) — project URL.
   - **`SUPABASE_SERVICE_ROLE_KEY`** — server-only; required for **POST** `/api/conflict/refresh` (bootstrap, ingestion, scoring). Never expose this key to the browser.
   - **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** — optional fallback for **read-only** heatmap/news GET routes if the service-role key is not set; schema grants `SELECT` on ConflictLens tables to `anon`.
   - **`NEWS_API_KEY`** — optional; enables NewsAPI articles in addition to RSS + GDELT ([`src/lib/conflict/ingest/news.ts`](src/lib/conflict/ingest/news.ts)).
   - **`CRON_SECRET`** — if set, refresh endpoints require `Authorization: Bearer <CRON_SECRET>` (or the Vercel cron header). If unset, refresh is open in development.

3. **First data load** — Open `/conflict` once; the app auto-bootstraps when the heatmap is empty (unless `localStorage.conflict_bootstrapped` is already set). Or run:

   ```bash
   curl -X POST "http://localhost:3000/api/conflict/refresh?step=bootstrap"
   ```

   Add the bearer token if `CRON_SECRET` is configured.

The ConflictLens UI surfaces configuration errors (e.g. missing Supabase keys) instead of showing only empty tables.

## Deploy on Vercel

Use the same env vars in the project settings; ensure `SUPABASE_SERVICE_ROLE_KEY` is **server-only** (not `NEXT_PUBLIC_*`).
