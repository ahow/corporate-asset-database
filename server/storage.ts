import {
  type Company,
  type InsertCompany,
  type Asset,
  type InsertAsset,
  companies,
  assets,
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, sql } from "drizzle-orm";

export interface IStorage {
  getCompanies(): Promise<Company[]>;
  getCompanyById(id: number): Promise<Company | undefined>;
  getCompanyByIsin(isin: string): Promise<Company | undefined>;
  getCompanyByName(name: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, data: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: number): Promise<boolean>;
  upsertCompany(company: InsertCompany): Promise<Company>;

  getAssets(): Promise<Asset[]>;
  getAssetById(id: number): Promise<Asset | undefined>;
  getAssetsByCompany(companyName: string): Promise<Asset[]>;
  getAssetsByIsin(isin: string): Promise<Asset[]>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAsset(id: number, data: Partial<InsertAsset>): Promise<Asset | undefined>;
  deleteAsset(id: number): Promise<boolean>;
  bulkCreateAssets(assetList: InsertAsset[]): Promise<void>;
  getAssetCount(): Promise<number>;
  getStats(): Promise<{
    total_assets: number;
    assets_with_coordinates: number;
    coordinate_coverage_percent: string;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getCompanies(): Promise<Company[]> {
    return db.select().from(companies).orderBy(companies.name);
  }

  async getCompanyById(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async getCompanyByIsin(isin: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.isin, isin));
    return company;
  }

  async getCompanyByName(name: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.name, name));
    return company;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [created] = await db.insert(companies).values(company).returning();
    return created;
  }

  async updateCompany(id: number, data: Partial<InsertCompany>): Promise<Company | undefined> {
    const [updated] = await db.update(companies).set(data).where(eq(companies.id, id)).returning();
    return updated;
  }

  async deleteCompany(id: number): Promise<boolean> {
    const result = await db.delete(companies).where(eq(companies.id, id)).returning();
    return result.length > 0;
  }

  async upsertCompany(company: InsertCompany): Promise<Company> {
    const [upserted] = await db
      .insert(companies)
      .values(company)
      .onConflictDoUpdate({
        target: companies.isin,
        set: {
          name: company.name,
          sector: company.sector,
          totalAssets: company.totalAssets,
          assetCount: company.assetCount,
        },
      })
      .returning();
    return upserted;
  }

  async getAssets(): Promise<Asset[]> {
    return db.select().from(assets).orderBy(assets.companyName, assets.facilityName);
  }

  async getAssetById(id: number): Promise<Asset | undefined> {
    const [asset] = await db.select().from(assets).where(eq(assets.id, id));
    return asset;
  }

  async getAssetsByCompany(companyName: string): Promise<Asset[]> {
    return db.select().from(assets).where(eq(assets.companyName, companyName));
  }

  async getAssetsByIsin(isin: string): Promise<Asset[]> {
    return db.select().from(assets).where(eq(assets.isin, isin));
  }

  async createAsset(asset: InsertAsset): Promise<Asset> {
    const [created] = await db.insert(assets).values(asset).returning();
    return created;
  }

  async updateAsset(id: number, data: Partial<InsertAsset>): Promise<Asset | undefined> {
    const [updated] = await db.update(assets).set(data).where(eq(assets.id, id)).returning();
    return updated;
  }

  async deleteAsset(id: number): Promise<boolean> {
    const result = await db.delete(assets).where(eq(assets.id, id)).returning();
    return result.length > 0;
  }

  async bulkCreateAssets(assetList: InsertAsset[]): Promise<void> {
    if (assetList.length === 0) return;
    const batchSize = 100;
    for (let i = 0; i < assetList.length; i += batchSize) {
      const batch = assetList.slice(i, i + batchSize);
      await db.insert(assets).values(batch);
    }
  }

  async getAssetCount(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(assets);
    return Number(result.count);
  }

  async getStats(): Promise<{
    total_assets: number;
    assets_with_coordinates: number;
    coordinate_coverage_percent: string;
  }> {
    const [total] = await db.select({ count: sql<number>`count(*)` }).from(assets);
    const [withCoords] = await db
      .select({ count: sql<number>`count(*)` })
      .from(assets)
      .where(sql`${assets.latitude} IS NOT NULL AND ${assets.longitude} IS NOT NULL`);
    const totalCount = Number(total.count);
    const coordCount = Number(withCoords.count);
    return {
      total_assets: totalCount,
      assets_with_coordinates: coordCount,
      coordinate_coverage_percent:
        totalCount > 0 ? ((coordCount / totalCount) * 100).toFixed(1) : "0.0",
    };
  }
}

export const storage = new DatabaseStorage();
