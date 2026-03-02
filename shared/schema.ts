import { sql } from "drizzle-orm";
import { pgTable, text, varchar, doublePrecision, integer, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  isin: varchar("isin", { length: 12 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  sector: varchar("sector", { length: 100 }),
  totalAssets: doublePrecision("total_assets"),
  assetCount: integer("asset_count").default(0),
});

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  isin: varchar("isin", { length: 12 }),
  facilityName: text("facility_name").notNull(),
  address: text("address"),
  city: varchar("city", { length: 255 }),
  country: varchar("country", { length: 255 }),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  coordinateCertainty: integer("coordinate_certainty"),
  assetType: varchar("asset_type", { length: 100 }),
  valueUsd: doublePrecision("value_usd"),
  sizeFactor: doublePrecision("size_factor"),
  geoFactor: doublePrecision("geo_factor"),
  typeWeight: doublePrecision("type_weight"),
  industryFactor: doublePrecision("industry_factor"),
  valuationConfidence: integer("valuation_confidence"),
  ownershipShare: doublePrecision("ownership_share").default(100),
  sector: varchar("sector", { length: 100 }),
  dataSource: text("data_source"),
  sourceDocument: text("source_document"),
  sourceUrl: text("source_url"),
});

export const discoveryJobs = pgTable("discovery_jobs", {
  id: serial("id").primaryKey(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  modelProvider: varchar("model_provider", { length: 50 }).default("openai"),
  supplementaryProvider: varchar("supplementary_provider", { length: 50 }),
  totalCompanies: integer("total_companies").notNull().default(0),
  completedCompanies: integer("completed_companies").notNull().default(0),
  failedCompanies: integer("failed_companies").notNull().default(0),
  companyNames: text("company_names").notNull(),
  companyEntries: text("company_entries"),
  results: text("results"),
  totalInputTokens: integer("total_input_tokens").default(0),
  totalOutputTokens: integer("total_output_tokens").default(0),
  totalCostUsd: doublePrecision("total_cost_usd").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertCompanySchema = createInsertSchema(companies).omit({ id: true });
export const insertAssetSchema = createInsertSchema(assets).omit({ id: true });
export const insertDiscoveryJobSchema = createInsertSchema(discoveryJobs).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assets.$inferSelect;
export type DiscoveryJob = typeof discoveryJobs.$inferSelect;
export type InsertDiscoveryJob = z.infer<typeof insertDiscoveryJobSchema>;

export * from "./models/chat";
