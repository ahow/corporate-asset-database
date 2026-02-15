import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAssetSchema, insertCompanySchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/assets", async (_req, res) => {
    try {
      const allAssets = await storage.getAssets();
      const stats = await storage.getStats();
      res.json({
        total_assets: stats.total_assets,
        assets_with_coordinates: stats.assets_with_coordinates,
        coordinate_coverage_percent: stats.coordinate_coverage_percent,
        assets: allAssets,
      });
    } catch (err) {
      console.error("Error fetching assets:", err);
      res.status(500).json({ message: "Failed to fetch assets" });
    }
  });

  app.get("/api/assets/company/:name", async (req, res) => {
    try {
      const companyAssets = await storage.getAssetsByCompany(req.params.name);
      res.json({
        company_name: req.params.name,
        total_assets: companyAssets.length,
        assets: companyAssets,
      });
    } catch (err) {
      console.error("Error fetching company assets:", err);
      res.status(500).json({ message: "Failed to fetch company assets" });
    }
  });

  app.get("/api/assets/isin/:isin", async (req, res) => {
    try {
      const isinAssets = await storage.getAssetsByIsin(req.params.isin);
      res.json({
        isin: req.params.isin,
        total_assets: isinAssets.length,
        assets: isinAssets,
      });
    } catch (err) {
      console.error("Error fetching ISIN assets:", err);
      res.status(500).json({ message: "Failed to fetch assets by ISIN" });
    }
  });

  app.get("/api/companies", async (_req, res) => {
    try {
      const allCompanies = await storage.getCompanies();
      res.json(allCompanies);
    } catch (err) {
      console.error("Error fetching companies:", err);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.get("/api/stats", async (_req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (err) {
      console.error("Error fetching stats:", err);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/assets/export/csv", async (_req, res) => {
    try {
      const allAssets = await storage.getAssets();
      const headers = [
        "Company Name",
        "ISIN",
        "Facility Name",
        "Asset Type",
        "Address",
        "City",
        "Country",
        "Latitude",
        "Longitude",
        "Coordinate Certainty",
        "Value (USD)",
        "Size Factor",
        "Geo Factor",
        "Type Weight",
        "Industry Factor",
        "Valuation Confidence",
        "Sector",
        "Data Source",
      ];

      const rows = allAssets.map((a) => [
        a.companyName,
        a.isin || "",
        a.facilityName,
        a.assetType || "",
        a.address || "",
        a.city || "",
        a.country || "",
        a.latitude?.toString() || "",
        a.longitude?.toString() || "",
        a.coordinateCertainty?.toString() || "",
        a.valueUsd?.toString() || "",
        a.sizeFactor?.toString() || "",
        a.geoFactor?.toString() || "",
        a.typeWeight?.toString() || "",
        a.industryFactor?.toString() || "",
        a.valuationConfidence?.toString() || "",
        a.sector || "",
        a.dataSource || "",
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) =>
          row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
        ),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="corporate_assets.csv"');
      res.send(csvContent);
    } catch (err) {
      console.error("Error exporting CSV:", err);
      res.status(500).json({ message: "Failed to export CSV" });
    }
  });

  app.post("/api/assets", async (req, res) => {
    try {
      const parsed = insertAssetSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }
      const created = await storage.createAsset(parsed.data);
      res.status(201).json(created);
    } catch (err) {
      console.error("Error creating asset:", err);
      res.status(500).json({ message: "Failed to create asset" });
    }
  });

  app.put("/api/assets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid asset ID" });
      const existing = await storage.getAssetById(id);
      if (!existing) return res.status(404).json({ message: "Asset not found" });
      const partial = insertAssetSchema.partial().safeParse(req.body);
      if (!partial.success) {
        return res.status(400).json({ message: "Validation failed", errors: partial.error.flatten() });
      }
      const updated = await storage.updateAsset(id, partial.data);
      res.json(updated);
    } catch (err) {
      console.error("Error updating asset:", err);
      res.status(500).json({ message: "Failed to update asset" });
    }
  });

  app.delete("/api/assets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid asset ID" });
      const deleted = await storage.deleteAsset(id);
      if (!deleted) return res.status(404).json({ message: "Asset not found" });
      res.json({ message: "Asset deleted" });
    } catch (err) {
      console.error("Error deleting asset:", err);
      res.status(500).json({ message: "Failed to delete asset" });
    }
  });

  app.post("/api/companies", async (req, res) => {
    try {
      const parsed = insertCompanySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }
      const created = await storage.createCompany(parsed.data);
      res.status(201).json(created);
    } catch (err) {
      console.error("Error creating company:", err);
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  app.put("/api/companies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid company ID" });
      const existing = await storage.getCompanyById(id);
      if (!existing) return res.status(404).json({ message: "Company not found" });
      const partial = insertCompanySchema.partial().safeParse(req.body);
      if (!partial.success) {
        return res.status(400).json({ message: "Validation failed", errors: partial.error.flatten() });
      }
      const updated = await storage.updateCompany(id, partial.data);
      res.json(updated);
    } catch (err) {
      console.error("Error updating company:", err);
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  app.delete("/api/companies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid company ID" });
      const deleted = await storage.deleteCompany(id);
      if (!deleted) return res.status(404).json({ message: "Company not found" });
      res.json({ message: "Company deleted" });
    } catch (err) {
      console.error("Error deleting company:", err);
      res.status(500).json({ message: "Failed to delete company" });
    }
  });

  return httpServer;
}
