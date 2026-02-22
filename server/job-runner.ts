import { storage } from "./storage";
import { discoverCompany, saveDiscoveredCompany, normalizeAssetValues, type ProgressCallback } from "./discovery";

interface CompanyEntry {
  name: string;
  isin?: string;
  totalValue?: number;
}

interface JobResult {
  name: string;
  status: string;
  assetsFound?: number;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  normalized?: boolean;
  webResearchUsed?: boolean;
}

let isProcessing = false;
let currentJobId: number | null = null;

export function getCurrentJobId(): number | null {
  return currentJobId;
}

export function isJobRunnerBusy(): boolean {
  return isProcessing;
}

export async function startJobRunner() {
  if (isProcessing) {
    console.log("[JobRunner] Already processing, skipping");
    return;
  }
  processNextJob();
}

async function processNextJob() {
  if (isProcessing) return;

  const jobs = await storage.getDiscoveryJobs();
  const pendingJob = jobs.find(j => j.status === "pending");
  if (!pendingJob) return;

  isProcessing = true;
  currentJobId = pendingJob.id;

  try {
    await runJob(pendingJob.id);
  } catch (err) {
    console.error(`[JobRunner] Fatal error processing job ${pendingJob.id}:`, err);
    try {
      await storage.updateDiscoveryJob(pendingJob.id, {
        status: "failed",
        updatedAt: new Date(),
      });
    } catch {}
  } finally {
    isProcessing = false;
    currentJobId = null;
    setTimeout(() => processNextJob(), 1000);
  }
}

async function runJob(jobId: number) {
  const job = await storage.getDiscoveryJob(jobId);
  if (!job) {
    console.error(`[JobRunner] Job ${jobId} not found`);
    return;
  }

  let entries: CompanyEntry[] = [];
  if (job.companyEntries) {
    try {
      entries = JSON.parse(job.companyEntries);
    } catch {}
  }
  if (entries.length === 0) {
    try {
      const names: string[] = JSON.parse(job.companyNames);
      entries = names.map(name => ({ name }));
    } catch {}
  }

  if (entries.length === 0) {
    await storage.updateDiscoveryJob(jobId, { status: "failed", updatedAt: new Date() });
    return;
  }

  const providerId = job.modelProvider || "openai";
  const existingResults: JobResult[] = job.results ? JSON.parse(job.results) : [];
  const processedNames = new Set(existingResults.map(r => r.name.toLowerCase()));

  const remainingEntries = entries.filter(e => {
    const displayName = e.isin ? `${e.name} (${e.isin})` : e.name;
    return !processedNames.has(e.name.toLowerCase()) && !processedNames.has(displayName.toLowerCase());
  });

  let results = [...existingResults];
  let completed = job.completedCompanies || 0;
  let failed = job.failedCompanies || 0;
  let totalInputTokens = job.totalInputTokens || 0;
  let totalOutputTokens = job.totalOutputTokens || 0;
  let totalCostUsd = job.totalCostUsd || 0;

  await storage.updateDiscoveryJob(jobId, {
    status: "running",
    updatedAt: new Date(),
  });

  console.log(`[JobRunner] Starting job ${jobId}: ${remainingEntries.length} remaining of ${entries.length} total, provider: ${providerId}`);

  for (const entry of remainingEntries) {
    const currentState = await storage.getDiscoveryJob(jobId);
    if (currentState && currentState.status === "cancelled") {
      console.log(`[JobRunner] Job ${jobId} was cancelled, stopping`);
      return;
    }

    const displayName = entry.isin ? `${entry.name} (${entry.isin})` : entry.name;
    console.log(`[JobRunner] Processing ${displayName} (${completed + failed + 1}/${entries.length})`);

    let lastError = "";
    let succeeded = false;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = attempt * 3000;
          console.log(`[JobRunner] Retrying ${displayName} (attempt ${attempt + 1}/${maxRetries + 1}) after ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
        }

        const progressCallback: ProgressCallback = (phase, detail) => {
          // no-op for background processing
        };

        const result = await discoverCompany(entry.name, providerId, entry.isin, progressCallback);
        const normalized = normalizeAssetValues(result.company, entry.totalValue);
        const saved = await saveDiscoveredCompany(result.company, providerId);

        completed++;
        totalInputTokens += result.totalInputTokens;
        totalOutputTokens += result.totalOutputTokens;
        totalCostUsd += result.totalCostUsd;

        results.push({
          name: result.company.name,
          status: "success",
          assetsFound: saved.assetCount,
          inputTokens: result.totalInputTokens,
          outputTokens: result.totalOutputTokens,
          costUsd: result.totalCostUsd,
          normalized,
          webResearchUsed: result.webResearchUsed,
        });

        console.log(`[JobRunner] ✓ ${result.company.name}: ${saved.assetCount} assets ($${result.totalCostUsd.toFixed(4)})`);
        succeeded = true;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Unknown error";
        const isRetryable = lastError.includes("429") || lastError.includes("rate") || lastError.includes("timeout") || lastError.includes("ECONNRESET") || lastError.includes("500") || lastError.includes("503") || lastError.includes("terminated") || lastError.includes("ETIMEDOUT") || lastError.includes("ECONNREFUSED") || lastError.includes("socket hang up") || lastError.includes("fetch failed");
        if (!isRetryable || attempt === maxRetries) break;
      }
    }

    if (!succeeded) {
      failed++;
      results.push({ name: displayName, status: "failed", error: lastError });
      console.log(`[JobRunner] ✗ ${displayName}: ${lastError}`);
    }

    await storage.updateDiscoveryJob(jobId, {
      completedCompanies: completed,
      failedCompanies: failed,
      results: JSON.stringify(results),
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd,
      updatedAt: new Date(),
    });
  }

  await storage.updateDiscoveryJob(jobId, {
    status: "complete",
    completedCompanies: completed,
    failedCompanies: failed,
    results: JSON.stringify(results),
    totalInputTokens,
    totalOutputTokens,
    totalCostUsd,
    updatedAt: new Date(),
  });

  console.log(`[JobRunner] Job ${jobId} complete: ${completed} succeeded, ${failed} failed, cost: $${totalCostUsd.toFixed(4)}`);
}

export async function cancelJob(jobId: number): Promise<boolean> {
  const job = await storage.getDiscoveryJob(jobId);
  if (!job || (job.status !== "running" && job.status !== "pending")) return false;
  await storage.updateDiscoveryJob(jobId, { status: "cancelled", updatedAt: new Date() });
  return true;
}

export async function markStaleJobsInterrupted() {
  const jobs = await storage.getDiscoveryJobs();
  const staleJobs = jobs.filter(j => j.status === "running");
  for (const j of staleJobs) {
    await storage.updateDiscoveryJob(j.id, { status: "interrupted", updatedAt: new Date() });
    console.log(`[JobRunner] Marked stale job ${j.id} as interrupted (was running at startup)`);
  }
}

export async function resumeJob(jobId: number): Promise<boolean> {
  const job = await storage.getDiscoveryJob(jobId);
  if (!job) return false;
  if (job.status !== "interrupted" && job.status !== "failed" && job.status !== "cancelled") return false;

  await storage.updateDiscoveryJob(jobId, { status: "pending", updatedAt: new Date() });
  console.log(`[JobRunner] Resuming job ${jobId} (was ${job.status})`);
  startJobRunner();
  return true;
}
