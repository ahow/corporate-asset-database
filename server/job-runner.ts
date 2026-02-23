import { storage } from "./storage";
import { discoverCompany, saveDiscoveredCompany, normalizeAssetValues, runSupplementaryPass, type ProgressCallback } from "./discovery";
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
  supplementaryAssetsFound?: number;
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
  const supplementaryProviderId = job.supplementaryProvider || null;
  const existingResults: JobResult[] = job.results ? JSON.parse(job.results) : [];
  const processedNames = new Set(existingResults.map(r => r.name.toLowerCase()));

  const primaryDone = existingResults.length > 0 && existingResults.every(r => 
    r.status === "success" || r.status === "failed"
  );
  const supplementaryNeeded = supplementaryProviderId && primaryDone;
  const supplementaryAlreadyRun = existingResults.some(r => r.supplementaryAssetsFound !== undefined);

  const remainingEntries = supplementaryNeeded ? [] : entries.filter(e => {
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

  if (remainingEntries.length > 0) {
    const parallelKeys = getParallelApiKeys(providerId);
    const useParallel = parallelKeys.length >= 2;
    const workerCount = useParallel ? parallelKeys.length : 1;
    activeWorkerCount = workerCount;

    console.log(`[JobRunner] Starting Phase 1 (${providerId}) for job ${jobId}: ${remainingEntries.length} remaining of ${entries.length} total, workers: ${workerCount}${useParallel ? " (parallel)" : " (sequential)"}${supplementaryProviderId ? `, supplementary: ${supplementaryProviderId}` : ""}`);

    if (useParallel) {
      await runParallel(jobId, remainingEntries, entries.length, providerId, parallelKeys, results, completed, failed, totalInputTokens, totalOutputTokens, totalCostUsd, !!supplementaryProviderId);
    } else {
      await runSequential(jobId, remainingEntries, entries.length, providerId, results, completed, failed, totalInputTokens, totalOutputTokens, totalCostUsd, !!supplementaryProviderId);
    }

    const updatedJob = await storage.getDiscoveryJob(jobId);
    if (updatedJob && updatedJob.status === "cancelled") return;
    results = updatedJob?.results ? JSON.parse(updatedJob.results) : results;
    completed = updatedJob?.completedCompanies || completed;
    failed = updatedJob?.failedCompanies || failed;
    totalInputTokens = updatedJob?.totalInputTokens || totalInputTokens;
    totalOutputTokens = updatedJob?.totalOutputTokens || totalOutputTokens;
    totalCostUsd = updatedJob?.totalCostUsd || totalCostUsd;
  }

  if (supplementaryProviderId && !supplementaryAlreadyRun) {
    const successResults = results.filter(r => r.status === "success");
    if (successResults.length > 0) {
      console.log(`[JobRunner] Starting Phase 2 (supplementary ${supplementaryProviderId}) for job ${jobId}: ${successResults.length} companies`);
      
      await runSupplementaryPhase(jobId, entries, supplementaryProviderId, results, totalInputTokens, totalOutputTokens, totalCostUsd);
      return;
    }
  }

  const finalJob = await storage.getDiscoveryJob(jobId);
  if (finalJob && finalJob.status === "running") {
    await storage.updateDiscoveryJob(jobId, {
      status: "complete",
      updatedAt: new Date(),
    });
    console.log(`[JobRunner] Job ${jobId} complete: ${completed} succeeded, ${failed} failed, cost: $${totalCostUsd.toFixed(4)}`);
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
  hasSupplementary: boolean = false,
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

  if (!hasSupplementary) {
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
  } else {
    console.log(`[JobRunner] Phase 1 complete for job ${jobId}: ${completed} succeeded, ${failed} failed. Supplementary phase next.`);
  }
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
  hasSupplementary: boolean = false,
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
    if (!hasSupplementary) {
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
    } else {
      await storage.updateDiscoveryJob(jobId, {
        completedCompanies: state.completed,
        failedCompanies: state.failed,
        results: JSON.stringify(state.results),
        totalInputTokens: state.totalInputTokens,
        totalOutputTokens: state.totalOutputTokens,
        totalCostUsd: state.totalCostUsd,
        updatedAt: new Date(),
      });
      console.log(`[JobRunner] Phase 1 complete for job ${jobId}: ${state.completed} succeeded, ${state.failed} failed. Supplementary phase next. (${apiKeys.length} workers)`);
    }
  }
}

async function processOneSupplementary(
  companyName: string,
  isin: string,
  sector: string,
  existingAssetCount: number,
  supplementaryProviderId: string,
  apiKey: string | undefined,
  workerId: number,
): Promise<{ additionalAssets: number; inputTokens: number; outputTokens: number; costUsd: number }> {
  const workerLabel = apiKey ? `S${workerId}` : "S0";
  console.log(`[JobRunner][${workerLabel}] Supplementary pass for ${companyName} (${existingAssetCount} existing assets)`);

  const assets = await storage.getAssetsByIsin(isin);
  if (assets.length === 0) {
    console.log(`[JobRunner][${workerLabel}] No existing assets found for ${companyName} (ISIN: ${isin}), skipping supplementary`);
    return { additionalAssets: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
  }

  const existingDiscoveredAssets = assets.map(a => ({
    facility_name: a.facilityName,
    address: a.address || '',
    city: a.city || '',
    country: a.country || '',
    latitude: a.latitude || 0,
    longitude: a.longitude || 0,
    coordinate_certainty: a.coordinateCertainty || 50,
    asset_type: a.assetType || 'Facility',
    value_usd: a.valueUsd || 0,
    size_factor: a.sizeFactor || 0.5,
    geo_factor: a.geoFactor || 1.0,
    type_weight: a.typeWeight || 1.0,
    industry_factor: a.industryFactor || 1.0,
    valuation_confidence: a.valuationConfidence || 50,
    ownership_share: a.ownershipShare ?? 100,
  }));

  let lastError = "";
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = attempt * 3000;
        console.log(`[JobRunner][${workerLabel}] Retrying supplementary for ${companyName} (attempt ${attempt + 1}/${maxRetries + 1})`);
        await new Promise(r => setTimeout(r, delay));
      }

      const result = await runSupplementaryPass(
        companyName, isin, sector, existingDiscoveredAssets,
        supplementaryProviderId, apiKey
      );

      if (result.additionalAssets.length > 0) {
        const providerLabel = supplementaryProviderId === "minimax" ? "MiniMax" :
          supplementaryProviderId === "deepseek" ? "DeepSeek" :
          supplementaryProviderId === "gemini" ? "Gemini" :
          supplementaryProviderId === "claude" ? "Claude" : supplementaryProviderId;

        const validAssets = result.additionalAssets.filter(a => {
          if (!a.facility_name && !a.asset_type && !a.city) return false;
          return true;
        });

        const assetInserts = validAssets.map((a, idx) => ({
          companyName,
          isin,
          facilityName: a.facility_name || `${companyName} ${a.asset_type || 'Facility'} Supp-${idx + 1}`,
          address: a.address || '',
          city: a.city || 'Unknown',
          country: a.country || 'Unknown',
          latitude: a.latitude,
          longitude: a.longitude,
          coordinateCertainty: a.coordinate_certainty,
          assetType: a.asset_type || 'Facility',
          valueUsd: a.value_usd,
          sizeFactor: a.size_factor,
          geoFactor: a.geo_factor,
          typeWeight: a.type_weight,
          industryFactor: a.industry_factor,
          valuationConfidence: a.valuation_confidence,
          ownershipShare: a.ownership_share ?? 100,
          sector,
          dataSource: `AI Discovery (${providerLabel} Supplementary)`,
        }));

        if (assetInserts.length > 0) {
          await storage.bulkCreateAssets(assetInserts as any);
          const totalAssets = assets.length + assetInserts.length;
          const totalValue = [...assets, ...assetInserts as any[]].reduce((sum, a) => sum + ((a.valueUsd || a.value_usd || 0) as number), 0);
          await storage.upsertCompany({ isin, name: companyName, sector, totalAssets: totalValue, assetCount: totalAssets });
        }

        console.log(`[JobRunner][${workerLabel}] ✓ Supplementary ${companyName}: +${assetInserts.length} new assets ($${result.costUsd.toFixed(4)})`);
      } else {
        console.log(`[JobRunner][${workerLabel}] ○ Supplementary ${companyName}: no new assets ($${result.costUsd.toFixed(4)})`);
      }

      return {
        additionalAssets: result.additionalAssets.length,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: result.costUsd,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Unknown error";
      if (!isRetryableError(lastError) || attempt === maxRetries) break;
    }
  }

  console.log(`[JobRunner][${workerLabel}] ✗ Supplementary ${companyName}: ${lastError}`);
  return { additionalAssets: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
}

async function runSupplementaryPhase(
  jobId: number,
  entries: CompanyEntry[],
  supplementaryProviderId: string,
  results: JobResult[],
  totalInputTokens: number,
  totalOutputTokens: number,
  totalCostUsd: number,
) {
  const successResults = results.filter(r => r.status === "success" && r.supplementaryAssetsFound === undefined);
  if (successResults.length === 0) {
    await storage.updateDiscoveryJob(jobId, { status: "complete", updatedAt: new Date() });
    return;
  }

  const parallelKeys = getParallelApiKeys(supplementaryProviderId);
  const useParallel = parallelKeys.length >= 2;
  const workerCount = useParallel ? parallelKeys.length : 1;
  activeWorkerCount = workerCount;

  console.log(`[JobRunner] Phase 2 (supplementary ${supplementaryProviderId}): ${successResults.length} companies, ${workerCount} workers${useParallel ? " (parallel)" : " (sequential)"}`);

  const entryMap = new Map(entries.map(e => [e.name.toLowerCase(), e]));
  const resultMap = new Map(results.map((r, i) => [r.name.toLowerCase(), i]));

  const companiesToProcess = successResults.map(r => {
    const entry = entryMap.get(r.name.toLowerCase()) || 
                  entries.find(e => r.name.toLowerCase().includes(e.name.toLowerCase()));
    return {
      name: r.name,
      isin: entry?.isin || '',
      sector: '',
      existingAssetCount: r.assetsFound || 0,
    };
  });

  for (const c of companiesToProcess) {
    if (!c.isin) {
      const assets = await storage.getAssetsByCompany(c.name);
      if (assets.length > 0) {
        c.isin = assets[0].isin || '';
        c.sector = assets[0].sector || '';
      }
    }
    if (!c.sector) {
      const companies = await storage.getCompanies();
      const match = companies.find(co => co.name.toLowerCase() === c.name.toLowerCase());
      if (match) c.sector = match.sector || '';
    }
  }

  if (useParallel) {
    const state = {
      queueIndex: 0,
      savePending: false,
    };

    const popNext = (): typeof companiesToProcess[0] | null => {
      if (state.queueIndex >= companiesToProcess.length) return null;
      const item = companiesToProcess[state.queueIndex++];
      return item;
    };

    const worker = async (workerId: number, apiKey: string) => {
      while (true) {
        const currentState = await storage.getDiscoveryJob(jobId);
        if (currentState && currentState.status === "cancelled") return;

        const item = popNext();
        if (!item) return;

        const suppResult = await processOneSupplementary(
          item.name, item.isin, item.sector, item.existingAssetCount,
          supplementaryProviderId, apiKey, workerId
        );

        const idx = resultMap.get(item.name.toLowerCase());
        if (idx !== undefined) {
          results[idx].supplementaryAssetsFound = suppResult.additionalAssets;
          results[idx].inputTokens = (results[idx].inputTokens || 0) + suppResult.inputTokens;
          results[idx].outputTokens = (results[idx].outputTokens || 0) + suppResult.outputTokens;
          results[idx].costUsd = (results[idx].costUsd || 0) + suppResult.costUsd;
        }
        totalInputTokens += suppResult.inputTokens;
        totalOutputTokens += suppResult.outputTokens;
        totalCostUsd += suppResult.costUsd;

        if (!state.savePending) {
          state.savePending = true;
          try {
            await storage.updateDiscoveryJob(jobId, {
              results: JSON.stringify(results),
              totalInputTokens,
              totalOutputTokens,
              totalCostUsd,
              updatedAt: new Date(),
            });
          } finally {
            state.savePending = false;
          }
        }
      }
    };

    const workerPromises = parallelKeys.map((key, i) => worker(i + 1, key));
    await Promise.all(workerPromises);
  } else {
    for (const item of companiesToProcess) {
      const currentState = await storage.getDiscoveryJob(jobId);
      if (currentState && currentState.status === "cancelled") return;

      const suppResult = await processOneSupplementary(
        item.name, item.isin, item.sector, item.existingAssetCount,
        supplementaryProviderId, undefined, 0
      );

      const idx = resultMap.get(item.name.toLowerCase());
      if (idx !== undefined) {
        results[idx].supplementaryAssetsFound = suppResult.additionalAssets;
        results[idx].inputTokens = (results[idx].inputTokens || 0) + suppResult.inputTokens;
        results[idx].outputTokens = (results[idx].outputTokens || 0) + suppResult.outputTokens;
        results[idx].costUsd = (results[idx].costUsd || 0) + suppResult.costUsd;
      }
      totalInputTokens += suppResult.inputTokens;
      totalOutputTokens += suppResult.outputTokens;
      totalCostUsd += suppResult.costUsd;

      await storage.updateDiscoveryJob(jobId, {
        results: JSON.stringify(results),
        totalInputTokens,
        totalOutputTokens,
        totalCostUsd,
        updatedAt: new Date(),
      });
    }
  }

  const finalState = await storage.getDiscoveryJob(jobId);
  if (finalState && finalState.status !== "cancelled") {
    const totalSupp = results.reduce((sum, r) => sum + (r.supplementaryAssetsFound || 0), 0);
    await storage.updateDiscoveryJob(jobId, {
      status: "complete",
      results: JSON.stringify(results),
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd,
      updatedAt: new Date(),
    });
    console.log(`[JobRunner] Job ${jobId} fully complete (Phase 1 + 2): supplementary added ${totalSupp} assets, total cost: $${totalCostUsd.toFixed(4)}`);
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
