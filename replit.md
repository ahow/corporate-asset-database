# Corporate Asset Database API

## Overview
A production-ready system that discovers, geolocates, and values physical assets for global corporations. Built with Node.js + Express + React + PostgreSQL on Replit, designed for deployment to Heroku via GitHub sync. Features AI-powered company discovery with multi-LLM support and cost tracking.

## Current State
- **15+ companies** seeded across multiple sectors (Technology, Energy, Industrials, etc.)
- **85+ physical assets** with coordinates, valuations, and metadata
- **100% geocoding coverage** on seed data
- **Multi-LLM AI Discovery** - Toggle between 5 AI providers (OpenAI, DeepSeek, Gemini, Claude, MiniMax) with real-time cost and token tracking
- **Two-Pass Deep Discovery** - Pass 1 finds initial assets, Pass 2 reviews and fills gaps by category (40+ assets for major mining companies)
- **Proximity-Based Deduplication** - Three-layer duplicate detection: exact name matching, city+type keys, and geographic proximity (haversine distance <5km + similar value within 3x ratio + related asset types) to catch assets named differently by different LLMs
- **Web-Enhanced Research** - Optional Serper API integration with sector-aware queries for grounding AI discovery with live Google search data
- PostgreSQL database for persistence
- REST API with Express backend
- React + shadcn/ui frontend dashboard

## Architecture
- **Frontend:** React + Vite + shadcn/ui + Tailwind CSS + Recharts
- **Backend:** Express.js with REST API routes
- **Background Jobs:** Server-side job runner processes discovery jobs independently of client connections (no SSE dependency)
- **Database:** PostgreSQL via Drizzle ORM
- **AI Providers:** OpenAI (Replit AI Integrations), DeepSeek, Google Gemini, Claude (Anthropic), MiniMax
- **Web Research:** Serper API for Google search grounding (optional, falls back gracefully)
- **Source Tracking:** Each asset includes `sourceDocument` (e.g., "2024 10-K Filing") and `sourceUrl` (link to the filing/report) for verification
- **Schema:** `shared/schema.ts` defines companies, assets (with source_document, source_url columns), discovery_jobs tables

## Key Files
- `shared/schema.ts` - Database schema (companies, assets with ownership_share, discoveryJobs tables)
- `server/routes.ts` - API endpoints including discovery SSE endpoint
- `server/storage.ts` - Database storage layer (DatabaseStorage class)
- `server/job-runner.ts` - Background job runner that processes discovery jobs server-side (independent of client connections)
- `server/discovery.ts` - Two-pass AI-powered company asset discovery logic (Pass 1: initial discovery, Pass 2: gap-filling review with deduplication)
- `server/serper.ts` - Web research module using Serper API for Google search grounding (6-11 sector-aware searches per company, 60 snippet limit)
- `server/llm-providers.ts` - Multi-LLM provider abstraction (OpenAI, DeepSeek, Gemini, Claude, MiniMax) with cost tracking
- `server/db.ts` - Database connection (with SSL for production/Heroku)
- `server/seed.ts` - Seed data with 15 companies and 85 assets
- `client/src/pages/dashboard.tsx` - Main dashboard page
- `client/src/pages/discover.tsx` - AI discovery page with CSV upload, ISIN support, model selector, progress tracking, and cost display
- `client/src/pages/methodology.tsx` - Methodology page explaining data discovery, valuation, and ownership
- `client/src/App.tsx` - Router with /, /discover, and /methodology routes
- `client/src/components/company-detail.tsx` - Company detail with Leaflet map, asset detail cards, and facilities table
- `client/src/components/` - UI components (stats-cards, asset-table, company-selector, sector-chart, company-detail, theme-provider, theme-toggle)

## API Endpoints
- `GET /api/assets` - All assets with stats
- `GET /api/companies` - All companies
- `GET /api/stats` - Summary statistics
- `GET /api/assets/company/:name` - Assets by company name
- `GET /api/assets/isin/:isin` - Assets by ISIN code
- `GET /api/assets/export/csv` - CSV export
- `GET /api/llm-providers` - Available LLM providers with costs
- `GET /api/serper/status` - Check if Serper web research is available
- `POST /api/discover` - Start AI discovery (returns jobId immediately, processes in background; body: { companies: string[] | {name, isin, totalValue?}[], provider: string })
- `GET /api/discover/jobs` - Discovery job history with model/cost tracking
- `GET /api/discover/jobs/:id` - Single discovery job details (poll for progress)
- `POST /api/discover/jobs/:id/cancel` - Cancel a running/pending job
- `POST /api/discover/jobs/:id/resume` - Resume an interrupted/failed/cancelled job
- CRUD: POST/PUT/DELETE for /api/assets and /api/companies

## LLM Providers
- **OpenAI** (gpt-4o-mini) - env: OPENAI_API_KEY (falls back to AI_INTEGRATIONS_OPENAI_API_KEY on Replit)
- **DeepSeek** (deepseek-chat) - OpenAI-compatible API, env: DEEPSEEK_API_KEY (parallel: DEEPSEEK_API_KEY_1 through DEEPSEEK_API_KEY_10 for up to 10 concurrent workers)
- **Google Gemini** (gemini-2.0-flash) - OpenAI-compatible API, env: GEMINI_API_KEY
- **Claude** (claude-sonnet-4) - Anthropic SDK, env: CLAUDE_API_KEY
- **MiniMax** (MiniMax-M2.5) - Native REST API, env: MINIMAX_API_KEY

## Development
- Run: `npm run dev`
- Database push: `npm run db:push`
- The app serves on port 5000

## User Preferences
- User intends to sync code to GitHub and deploy to Heroku
- Application based on technical documentation from Manus AI platform
- Original system used tRPC + JSON files; adapted to Express REST + PostgreSQL
