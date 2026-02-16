import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const poolConfig: pg.PoolConfig = {
  connectionString: process.env.DATABASE_URL,
};

if (process.env.NODE_ENV === "production") {
  poolConfig.ssl = { rejectUnauthorized: false };
}

export const pool = new pg.Pool(poolConfig);

export const db = drizzle(pool, { schema });

export async function ensureTables() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        isin VARCHAR(12) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        sector VARCHAR(100),
        total_assets DOUBLE PRECISION,
        asset_count INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS assets (
        id SERIAL PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        isin VARCHAR(12),
        facility_name TEXT NOT NULL,
        address TEXT,
        city VARCHAR(255),
        country VARCHAR(255),
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        coordinate_certainty INTEGER,
        asset_type VARCHAR(100),
        value_usd DOUBLE PRECISION,
        size_factor DOUBLE PRECISION,
        geo_factor DOUBLE PRECISION,
        type_weight DOUBLE PRECISION,
        industry_factor DOUBLE PRECISION,
        valuation_confidence INTEGER,
        ownership_share DOUBLE PRECISION DEFAULT 100,
        sector VARCHAR(100),
        data_source TEXT
      );
      CREATE TABLE IF NOT EXISTS discovery_jobs (
        id SERIAL PRIMARY KEY,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        model_provider VARCHAR(50) DEFAULT 'openai',
        total_companies INTEGER NOT NULL DEFAULT 0,
        completed_companies INTEGER NOT NULL DEFAULT 0,
        failed_companies INTEGER NOT NULL DEFAULT 0,
        company_names TEXT NOT NULL,
        results TEXT,
        total_input_tokens INTEGER DEFAULT 0,
        total_output_tokens INTEGER DEFAULT 0,
        total_cost_usd DOUBLE PRECISION DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    console.log("Database tables verified/created successfully");
  } catch (err) {
    console.error("Error ensuring tables:", err);
  } finally {
    client.release();
  }
}
