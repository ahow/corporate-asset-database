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
