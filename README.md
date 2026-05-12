# AtlasLayer

## Project Overview

AtlasLayer is a full-stack platform for geospatial and land intelligence.
It brings together real estate analysis, agricultural modeling, and country risk scoring in one system.

The goal is simple. Turn raw land and regional data into structured, usable intelligence.

---

## Modules

### Parcelis

Real estate parcel intelligence system.

* Property analysis
* Home fit evaluation
* Parcel-level APIs

---

### Fieldstone

Agricultural land analytics platform.

* Land productivity insights
* Scenario modeling
* Portfolio-level analysis

---

### ConflictLens

Geopolitical risk intelligence system.

* Country risk scoring
* Travel advisory integration
* News and social signal ingestion
* Heatmap visualization

---

## Tech Stack

* Next.js (App Router)
* TypeScript
* Supabase
* PostgreSQL + PostGIS
* Vercel
* REST APIs

---

## Getting Started

### Install dependencies

```bash
npm install
```

### Run development server

```bash
npm run dev
```

### Open application

```
http://localhost:3000
```

---

## Project Structure

**/app**
Main UI routes and pages

**/api**
Backend API endpoints for all modules

**/lib**
Shared utilities and helper functions

**/supabase**
Database schema and SQL setup files

---

## Environment Variables

Create a `.env.local` file:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEWS_API_KEY=
CRON_SECRET=
```

---

## Database Setup

Run the following in Supabase SQL editor:

* `supabase/schema.sql`
* `supabase/conflictlens.sql`

These create:

* Tables
* Views
* Geospatial layers
* Risk scoring system

After running:

* Refresh schema in Supabase
* Or wait for automatic sync

---

## ConflictLens Data Bootstrapping

If the database is empty, open:

```
/conflict
```

The system can auto-bootstrap data.

Or manually trigger:

```bash
POST /api/conflict/refresh?step=bootstrap
```

---

## Deployment

Deploy using Vercel.

Make sure:

* Environment variables are set in Vercel project settings
* `SUPABASE_SERVICE_ROLE_KEY` stays server-side only
* No sensitive keys are exposed to the client

---
