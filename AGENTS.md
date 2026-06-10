<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### Services overview

PropertyVision is a Next.js 16 (App Router, Turbopack) monolith with three products:

| Product | Route | Key deps |
|---------|-------|----------|
| Parcelis | `/parcelis` | Mapbox, Anthropic Claude, Census/OSM/USGS/FEMA APIs |
| Fieldstone | `/fieldstone` | Mapbox, Anthropic Claude |
| ConflictLens | `/conflict` | Supabase (PostGIS), Mapbox, news/RSS/GDELT |

### Running the dev server

```bash
npm run dev        # starts Next.js on http://localhost:3000
```

All required env vars (`NEXT_PUBLIC_MAPBOX_TOKEN`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) are injected via Cloud Agent secrets and are available in the process environment—no `.env.local` file is needed.

### Lint / Build / Test

- **Lint:** `npx eslint src/` — pre-existing warnings/errors exist (mostly `no-explicit-any` and unused vars); the lint infrastructure itself works.
- **Build:** `npm run build` — compiles with Turbopack, no test suite exists.
- **No automated test suite** — the repo has no test files or test runner configured.

### ConflictLens bootstrap

On first use the `countries` table in Supabase will be empty. To seed:

```bash
curl -X POST "http://localhost:3000/api/conflict/refresh?step=bootstrap"
```

Or simply open `/conflict` in the browser — the UI auto-bootstraps when data is empty.

### Gotchas

- The CAD scraper (Puppeteer) requires system Chromium. If it's missing the scraper gracefully fails — Parcelis still works for geocoding and map features.
- `NEXT_PUBLIC_*` variables are inlined at build/dev-start time. If you change these secrets you must restart the dev server.
- ESLint config uses the flat config format (`eslint.config.mjs`) with `eslint-config-next` — requires ESLint 9+.
