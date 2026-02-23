import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAssetSchema, insertCompanySchema } from "@shared/schema";
import { discoverCompany, saveDiscoveredCompany, normalizeAssetValues, type MultiPassDiscoveryResult, type ProgressCallback } from "./discovery";
import { getAvailableProviders } from "./llm-providers";
import { isSerperAvailable } from "./serper";
import { startJobRunner, cancelJob, resumeJob, isJobRunnerBusy, getActiveWorkerCount } from "./job-runner";
import { getParallelApiKeys } from "./llm-providers";

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
        "Ownership Share (%)",
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
        a.ownershipShare?.toString() || "100",
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

  app.get("/api/llm-providers", (_req, res) => {
    res.json(getAvailableProviders());
  });

  app.get("/api/serper/status", (_req, res) => {
    res.json({ available: isSerperAvailable() });
  });

  app.get("/api/parallel-status", (_req, res) => {
    const providers: Record<string, { available: boolean; workerCount: number }> = {};
    for (const pid of ["deepseek", "minimax"]) {
      const keys = getParallelApiKeys(pid);
      providers[pid] = { available: keys.length >= 2, workerCount: keys.length };
    }
    res.json({
      providers,
      activeWorkers: getActiveWorkerCount(),
    });
  });

  app.get("/api/health/providers", async (_req, res) => {
    const providers = getAvailableProviders();
    const results: Record<string, { available: boolean; keySet: boolean; keyPreview?: string }> = {};
    for (const p of providers) {
      const keyName = p.id === "openai" ? "OPENAI_API_KEY / AI_INTEGRATIONS_OPENAI_API_KEY"
        : p.id === "deepseek" ? "DEEPSEEK_API_KEY"
        : p.id === "gemini" ? "GEMINI_API_KEY"
        : p.id === "claude" ? "CLAUDE_API_KEY"
        : p.id === "minimax" ? "MINIMAX_API_KEY" : "unknown";
      results[p.id] = {
        available: p.available,
        keySet: p.available,
        keyPreview: p.available ? `${keyName} = ...${("set").slice(-3)}` : `${keyName} = not set`,
      };
    }
    res.json({
      providers: results,
      serperAvailable: isSerperAvailable(),
      nodeEnv: process.env.NODE_ENV || "not set",
      databaseConnected: true,
    });
  });

  app.get("/api/version", (_req, res) => {
    res.json({
      version: "v2-twopass",
      features: ["two-pass-discovery", "web-research-enhanced", "progress-callbacks", "deduplication"],
      buildTime: new Date().toISOString(),
    });
  });

  app.post("/api/discover", async (req, res) => {
    try {
      const { companies: companyEntries, provider: providerId = "openai", supplementaryProvider } = req.body;
      if (!companyEntries || !Array.isArray(companyEntries) || companyEntries.length === 0) {
        return res.status(400).json({ message: "Provide an array of companies" });
      }

      const entries: Array<{ name: string; isin?: string; totalValue?: number }> = companyEntries.map((entry: any) => {
        if (typeof entry === "string") {
          return { name: entry.trim() };
        }
        const rawIsin = (entry.isin || "").trim().toUpperCase();
        const totalValue = typeof entry.totalValue === "number" && entry.totalValue > 0 ? entry.totalValue : undefined;
        return { name: (entry.name || "").trim(), isin: rawIsin || undefined, totalValue };
      }).filter((e: { name: string }) => e.name.length > 0);

      if (entries.length === 0) {
        return res.status(400).json({ message: "No valid company entries provided" });
      }

      const names = entries.map((e) => e.name);

      const job = await storage.createDiscoveryJob({
        status: "pending",
        modelProvider: providerId,
        supplementaryProvider: supplementaryProvider || null,
        totalCompanies: entries.length,
        completedCompanies: 0,
        failedCompanies: 0,
        companyNames: JSON.stringify(names),
        companyEntries: JSON.stringify(entries),
        results: null,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCostUsd: 0,
      });

      console.log(`[Discovery] Created background job ${job.id} for ${entries.length} companies with provider ${providerId}${supplementaryProvider ? ` + supplementary: ${supplementaryProvider}` : ""}`);

      startJobRunner();

      res.json({ jobId: job.id, total: entries.length, provider: providerId, status: "pending" });
    } catch (err) {
      const errorDetail = err instanceof Error ? err.message : String(err);
      console.error("Error creating discovery job:", errorDetail, err);
      res.status(500).json({ message: `Failed to start discovery: ${errorDetail}` });
    }
  });

  app.post("/api/discover/jobs/:id/cancel", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid job ID" });
      const success = await cancelJob(id);
      if (!success) return res.status(400).json({ message: "Job cannot be cancelled (not running or pending)" });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to cancel job" });
    }
  });

  app.post("/api/discover/jobs/:id/resume", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid job ID" });
      const success = await resumeJob(id);
      if (!success) return res.status(400).json({ message: "Job cannot be resumed" });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to resume job" });
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
