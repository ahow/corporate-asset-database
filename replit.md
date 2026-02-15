# Corporate Asset Database API

## Overview
A production-ready system that discovers, geolocates, and values physical assets for global corporations. Built with Node.js + Express + React + PostgreSQL on Replit, designed for deployment to Heroku via GitHub sync. Features AI-powered company discovery using OpenAI (via Replit AI Integrations).

## Current State
- **15+ companies** seeded across multiple sectors (Technology, Energy, Industrials, etc.)
- **85+ physical assets** with coordinates, valuations, and metadata
- **100% geocoding coverage** on seed data
- **AI Discovery** - Enter company names, AI researches and finds their physical assets
- PostgreSQL database for persistence
- REST API with Express backend
- React + shadcn/ui frontend dashboard

## Architecture
- **Frontend:** React + Vite + shadcn/ui + Tailwind CSS + Recharts
- **Backend:** Express.js with REST API routes
- **Database:** PostgreSQL via Drizzle ORM
- **AI:** OpenAI via Replit AI Integrations (gpt-5-mini for discovery)
- **Schema:** `shared/schema.ts` defines companies, assets, discovery_jobs tables

## Key Files
- `shared/schema.ts` - Database schema (companies, assets, discoveryJobs tables)
- `server/routes.ts` - API endpoints including discovery SSE endpoint
- `server/storage.ts` - Database storage layer (DatabaseStorage class)
- `server/discovery.ts` - AI-powered company asset discovery logic
- `server/db.ts` - Database connection (with SSL for production/Heroku)
- `server/seed.ts` - Seed data with 15 companies and 85 assets
- `client/src/pages/dashboard.tsx` - Main dashboard page
- `client/src/pages/discover.tsx` - AI discovery page with progress tracking
- `client/src/App.tsx` - Router with / and /discover routes
- `client/src/components/` - UI components (stats-cards, asset-table, company-selector, sector-chart, company-detail, theme-provider, theme-toggle)

## API Endpoints
- `GET /api/assets` - All assets with stats
- `GET /api/companies` - All companies
- `GET /api/stats` - Summary statistics
- `GET /api/assets/company/:name` - Assets by company name
- `GET /api/assets/isin/:isin` - Assets by ISIN code
- `GET /api/assets/export/csv` - CSV export
- `POST /api/discover` - Start AI discovery (SSE stream, body: { companies: string[] })
- `GET /api/discover/jobs` - Discovery job history
- `GET /api/discover/jobs/:id` - Single discovery job details
- CRUD: POST/PUT/DELETE for /api/assets and /api/companies

## Development
- Run: `npm run dev`
- Database push: `npm run db:push`
- The app serves on port 5000

## User Preferences
- User intends to sync code to GitHub and deploy to Heroku
- Application based on technical documentation from Manus AI platform
- Original system used tRPC + JSON files; adapted to Express REST + PostgreSQL
