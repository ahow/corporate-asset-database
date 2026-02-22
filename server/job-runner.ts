import { storage } from "./storage";
import { discoverCompany, saveDiscoveredCompany, normalizeAssetValues, type ProgressCallback } from "./discovery";
import { getParallelApiKeys } from "./llm-providers";

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
  workerId?: number;
}

let isProcessing = false;
let currentJobId: number | null = null;
let activeWorkerCount = 0;

export function getCurrentJobId(): number | null {
  return currentJobId;
}

export function isJobRunnerBusy(): boolean {
  return isProcessing;
}

export function getActiveWorkerCount(): number {
  return activeWorkerCount;
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
    activeWorkerCount = 0;
    setTimeout(() => processNextJob(), 1000);
  }
}

function isRetryableError(message: string): boolean {
  return message.includes("429") || message.includes("rate") || message.includes("timeout") || message.includes("ECONNRESET") || message.includes("500") || message.includes("503") || message.includes("terminated") || message.includes("ETIMEDOUT") || message.includes("ECONNREFUSED") || message.includes("socket hang up") || message.includes("fetch failed");
}

async function processOneCompany(
  entry: CompanyEntry,
  providerId: string,
  apiKey: string | undefined,
  workerId: number,
  entryIndex: number,
  totalEntries: number,
): Promise<JobResult> {
  const displayName = entry.isin ? `${entry.name} (${entry.isin})` : entry.name;
  const workerLabel = apiKey ? `W${workerId}` : "W0";
  console.log(`[JobRunner][${workerLabel}] Processing ${displayName} (${entryIndex}/${totalEntries})`);

  let lastError = "";
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = attempt * 3000;
        console.log(`[JobRunner][${workerLabel}] Retrying ${displayName} (attempt ${attempt + 1}/${maxRetries + 1}) after ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      }

      const progressCallback: ProgressCallback = (phase, detail) => {};

      const result = await discoverCompany(entry.name, providerId, entry.isin, progressCallback, apiKey);
      const normalized = normalizeAssetValues(result.company, entry.totalValue);
      const saved = await saveDiscoveredCompany(result.company, providerId);

      console.log(`[JobRunner][${workerLabel}] ✓ ${result.company.name}: ${saved.assetCount} assets ($${result.totalCostUsd.toFixed(4)})`);

      return {
        name: result.company.name,
        status: "success",
        assetsFound: saved.assetCount,
        inputTokens: result.totalInputTokens,
        outputTokens: result.totalOutputTokens,
        costUsd: result.totalCostUsd,
        normalized,
        webResearchUsed: result.webResearchUsed,
        workerId,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Unknown error";
      if (!isRetryableError(lastError) || attempt === maxRetries) break;
    }
  }

  console.log(`[JobRunner][${workerLabel}] ✗ ${displayName}: ${lastError}`);
  return { name: displayName, status: "failed", error: lastError, workerId };
}

async function runJob(jobId: number) {
  const job = await storage.getDiscoveryJob(jobId);
  if (!job) {
    console.error(`[JobRunner] Job ${jobId} not found`);
    return;
  }

  let entries: CompanyEntry[] = [];
  if (job.companyEntries) {
    try { entries = JSON.parse(job.companyEntries); } catch {}
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

  const parallelKeys = providerId === "deepseek" ? getParallelApiKeys("deepseek") : [];
  const useParallel = parallelKeys.length >= 2;
  const workerCount = useParallel ? parallelKeys.length : 1;
  activeWorkerCount = workerCount;

  console.log(`[JobRunner] Starting job ${jobId}: ${remainingEntries.length} remaining of ${entries.length} total, provider: ${providerId}, workers: ${workerCount}${useParallel ? " (parallel)" : " (sequential)"}`);

  if (useParallel) {
    await runParallel(jobId, remainingEntries, entries.length, providerId, parallelKeys, results, completed, failed, totalInputTokens, totalOutputTokens, totalCostUsd);
  } else {
    await runSequential(jobId, remainingEntries, entries.length, providerId, results, completed, failed, totalInputTokens, totalOutputTokens, totalCostUsd);
  }
}

async function runSequential(
  jobId: number,
  remainingEntries: CompanyEntry[],
  totalEntries: number,
  providerId: string,
  results: JobResult[],
  completed: number,
  failed: number,
  totalInputTokens: number,
  totalOutputTokens: number,
  totalCostUsd: number,
) {
  for (const entry of remainingEntries) {
    const currentState = await storage.getDiscoveryJob(jobId);
    if (currentState && currentState.status === "cancelled") {
      console.log(`[JobRunner] Job ${jobId} was cancelled, stopping`);
      return;
    }

    const result = await processOneCompany(entry, providerId, undefined, 0, completed + failed + 1, totalEntries);

    if (result.status === "success") {
      completed++;
      totalInputTokens += result.inputTokens || 0;
      totalOutputTokens += result.outputTokens || 0;
      totalCostUsd += result.costUsd || 0;
    } else {
      failed++;
    }
    results.push(result);

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

async function runParallel(
  jobId: number,
  remainingEntries: CompanyEntry[],
  totalEntries: number,
  providerId: string,
  apiKeys: string[],
  initialResults: JobResult[],
  initialCompleted: number,
  initialFailed: number,
  initialInputTokens: number,
  initialOutputTokens: number,
  initialCostUsd: number,
) {
  const state = {
    results: [...initialResults],
    completed: initialCompleted,
    failed: initialFailed,
    totalInputTokens: initialInputTokens,
    totalOutputTokens: initialOutputTokens,
    totalCostUsd: initialCostUsd,
    queueIndex: 0,
    cancelled: false,
    savePending: false,
  };

  const queue = [...remainingEntries];

  const popNextEntry = (): { entry: CompanyEntry; index: number } | null => {
    if (state.queueIndex >= queue.length) return null;
    const index = state.queueIndex;
    state.queueIndex++;
    return { entry: queue[index], index };
  };

  const recordResult = (result: JobResult) => {
    if (result.status === "success") {
      state.completed++;
      state.totalInputTokens += result.inputTokens || 0;
      state.totalOutputTokens += result.outputTokens || 0;
      state.totalCostUsd += result.costUsd || 0;
    } else {
      state.failed++;
    }
    state.results.push(result);
  };

  const saveProgress = async () => {
    if (state.savePending) return;
    state.savePending = true;
    try {
      await storage.updateDiscoveryJob(jobId, {
        completedCompanies: state.completed,
        failedCompanies: state.failed,
        results: JSON.stringify(state.results),
        totalInputTokens: state.totalInputTokens,
        totalOutputTokens: state.totalOutputTokens,
        totalCostUsd: state.totalCostUsd,
        updatedAt: new Date(),
      });
    } finally {
      state.savePending = false;
    }
  };

  const checkCancelled = async (): Promise<boolean> => {
    if (state.cancelled) return true;
    const currentState = await storage.getDiscoveryJob(jobId);
    if (currentState && currentState.status === "cancelled") {
      state.cancelled = true;
      console.log(`[JobRunner] Job ${jobId} was cancelled, stopping workers`);
      return true;
    }
    return false;
  };

  const worker = async (workerId: number, apiKey: string) => {
    while (true) {
      if (await checkCancelled()) return;

      const item = popNextEntry();
      if (!item) return;

      const { entry } = item;
      const overallIndex = state.completed + state.failed + 1;

      const result = await processOneCompany(
        entry, providerId, apiKey, workerId,
        overallIndex, totalEntries
      );

      recordResult(result);
      await saveProgress();
    }
  };

  console.log(`[JobRunner] Starting ${apiKeys.length} parallel workers for job ${jobId}`);

  const workerPromises = apiKeys.map((key, i) => worker(i + 1, key));
  await Promise.all(workerPromises);

  if (!state.cancelled) {
    await storage.updateDiscoveryJob(jobId, {
      status: "complete",
      completedCompanies: state.completed,
      failedCompanies: state.failed,
      results: JSON.stringify(state.results),
      totalInputTokens: state.totalInputTokens,
      totalOutputTokens: state.totalOutputTokens,
      totalCostUsd: state.totalCostUsd,
      updatedAt: new Date(),
    });

    console.log(`[JobRunner] Job ${jobId} complete: ${state.completed} succeeded, ${state.failed} failed, cost: $${state.totalCostUsd.toFixed(4)} (${apiKeys.length} workers)`);
  }
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
