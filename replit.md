# Corporate Asset Database API

## Overview
A production-ready system that discovers, geolocates, and values physical assets for global corporations. Built with Node.js + Express + React + PostgreSQL on Replit, designed for deployment to Heroku via GitHub sync.

## Current State
- **15 companies** seeded across multiple sectors (Technology, Energy, Industrials, etc.)
- **85 physical assets** with coordinates, valuations, and metadata
- **100% geocoding coverage** on seed data
- PostgreSQL database for persistence
- REST API with Express backend
- React + shadcn/ui frontend dashboard

## Architecture
- **Frontend:** React + Vite + shadcn/ui + Tailwind CSS + Recharts
- **Backend:** Express.js with REST API routes
- **Database:** PostgreSQL via Drizzle ORM
- **Schema:** `shared/schema.ts` defines companies and assets tables

## Key Files
- `shared/schema.ts` - Database schema (companies, assets tables)
- `server/routes.ts` - API endpoints (/api/assets, /api/companies, /api/stats, /api/assets/export/csv)
- `server/storage.ts` - Database storage layer (DatabaseStorage class)
- `server/db.ts` - Database connection
- `server/seed.ts` - Seed data with 15 companies and 85 assets
- `client/src/pages/dashboard.tsx` - Main dashboard page
- `client/src/components/` - UI components (stats-cards, asset-table, company-selector, sector-chart, company-detail, theme-provider, theme-toggle)

## API Endpoints
- `GET /api/assets` - All assets with stats
- `GET /api/companies` - All companies
- `GET /api/stats` - Summary statistics
- `GET /api/assets/company/:name` - Assets by company name
- `GET /api/assets/isin/:isin` - Assets by ISIN code
- `GET /api/assets/export/csv` - CSV export

## Development
- Run: `npm run dev`
- Database push: `npm run db:push`
- The app serves on port 5000

## User Preferences
- User intends to sync code to GitHub and deploy to Heroku
- Application based on technical documentation from Manus AI platform
- Original system used tRPC + JSON files; adapted to Express REST + PostgreSQL
