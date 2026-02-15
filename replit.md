# Corporate Asset Database API

## Overview
A production-ready system that discovers, geolocates, and values physical assets for global corporations. Built with Node.js + Express + React + PostgreSQL on Replit, designed for deployment to Heroku via GitHub sync. Features AI-powered company discovery with multi-LLM support and cost tracking.

## Current State
- **15+ companies** seeded across multiple sectors (Technology, Energy, Industrials, etc.)
- **85+ physical assets** with coordinates, valuations, and metadata
- **100% geocoding coverage** on seed data
- **Multi-LLM AI Discovery** - Toggle between 5 AI providers (OpenAI, DeepSeek, Gemini, Claude, MiniMax) with real-time cost and token tracking
- PostgreSQL database for persistence
- REST API with Express backend
- React + shadcn/ui frontend dashboard

## Architecture
- **Frontend:** React + Vite + shadcn/ui + Tailwind CSS + Recharts
- **Backend:** Express.js with REST API routes
- **Database:** PostgreSQL via Drizzle ORM
- **AI Providers:** OpenAI (Replit AI Integrations), DeepSeek, Google Gemini, Claude (Anthropic), MiniMax
- **Schema:** `shared/schema.ts` defines companies, assets, discovery_jobs tables

## Key Files
- `shared/schema.ts` - Database schema (companies, assets with ownership_share, discoveryJobs tables)
- `server/routes.ts` - API endpoints including discovery SSE endpoint
- `server/storage.ts` - Database storage layer (DatabaseStorage class)
- `server/discovery.ts` - AI-powered company asset discovery logic (includes ownership_share)
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
- `POST /api/discover` - Start AI discovery (SSE stream, body: { companies: string[] | {name, isin}[], provider: string })
- `GET /api/discover/jobs` - Discovery job history with model/cost tracking
- `GET /api/discover/jobs/:id` - Single discovery job details
- CRUD: POST/PUT/DELETE for /api/assets and /api/companies

## LLM Providers
- **OpenAI** (gpt-5-mini) - via Replit AI Integrations, env: AI_INTEGRATIONS_OPENAI_API_KEY
- **DeepSeek** (deepseek-chat) - OpenAI-compatible API, env: DEEPSEEK_API_KEY
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
