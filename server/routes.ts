import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAssetSchema, insertCompanySchema } from "@shared/schema";
import { discoverCompany, saveDiscoveredCompany } from "./discovery";

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

  app.post("/api/discover", async (req, res) => {
    try {
      const { companies: companyNames } = req.body;
      if (!companyNames || !Array.isArray(companyNames) || companyNames.length === 0) {
        return res.status(400).json({ message: "Provide an array of company names" });
      }

      const names = companyNames.map((n: string) => n.trim()).filter(Boolean);
      if (names.length === 0) {
        return res.status(400).json({ message: "No valid company names provided" });
      }

      const job = await storage.createDiscoveryJob({
        status: "running",
        totalCompanies: names.length,
        completedCompanies: 0,
        failedCompanies: 0,
        companyNames: JSON.stringify(names),
        results: null,
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      let clientDisconnected = false;
      req.on("close", () => { clientDisconnected = true; });

      res.write(`data: ${JSON.stringify({ type: "started", jobId: job.id, total: names.length })}\n\n`);

      const results: Array<{ name: string; status: string; assetsFound?: number; error?: string }> = [];
      let completed = 0;
      let failed = 0;

      for (const name of names) {
        if (clientDisconnected) break;
        res.write(`data: ${JSON.stringify({ type: "processing", company: name, index: completed + failed })}\n\n`);
        try {
          const discovered = await discoverCompany(name);
          const saved = await saveDiscoveredCompany(discovered);
          completed++;
          results.push({ name: discovered.name, status: "success", assetsFound: saved.assetCount });
          res.write(`data: ${JSON.stringify({ type: "completed", company: discovered.name, assetsFound: saved.assetCount, completed, failed, total: names.length })}\n\n`);
        } catch (err) {
          failed++;
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          results.push({ name, status: "failed", error: errorMsg });
          res.write(`data: ${JSON.stringify({ type: "error", company: name, error: errorMsg, completed, failed, total: names.length })}\n\n`);
        }

        await storage.updateDiscoveryJob(job.id, {
          completedCompanies: completed,
          failedCompanies: failed,
          results: JSON.stringify(results),
        });
      }

      await storage.updateDiscoveryJob(job.id, {
        status: "complete",
        completedCompanies: completed,
        failedCompanies: failed,
        results: JSON.stringify(results),
      });

      res.write(`data: ${JSON.stringify({ type: "done", jobId: job.id, completed, failed, total: names.length, results })}\n\n`);
      res.end();
    } catch (err) {
      console.error("Error in discovery:", err);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "fatal_error", error: "Discovery process failed" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "Discovery failed" });
      }
    }
  });

  app.get("/api/discover/jobs", async (_req, res) => {
    try {
      const jobs = await storage.getDiscoveryJobs();
      res.json(jobs);
    } catch (err) {
      console.error("Error fetching discovery jobs:", err);
      res.status(500).json({ message: "Failed to fetch discovery jobs" });
    }
  });

  app.get("/api/discover/jobs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid job ID" });
      const job = await storage.getDiscoveryJob(id);
      if (!job) return res.status(404).json({ message: "Job not found" });
      res.json(job);
    } catch (err) {
      console.error("Error fetching discovery job:", err);
      res.status(500).json({ message: "Failed to fetch discovery job" });
    }
  });

  return httpServer;
}
