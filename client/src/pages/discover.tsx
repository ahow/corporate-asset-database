import { useState, useRef, useCallback, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  Building2,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  DollarSign,
  Zap,
  Brain,
  Upload,
  FileText,
  X,
  Globe,
  ChevronDown,
  ChevronRight,
  Clock,
} from "lucide-react";
import { Link } from "wouter";

interface LLMProvider {
  id: string;
  name: string;
  model: string;
  costPer1kInputTokens: number;
  costPer1kOutputTokens: number;
  available: boolean;
}

interface CompanyEntry {
  name: string;
  isin?: string;
  totalValue?: number;
}

interface DiscoveryResult {
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

interface DiscoveryEvent {
  type: string;
  jobId?: number;
  total?: number;
  company?: string;
  index?: number;
  assetsFound?: number;
  completed?: number;
  failed?: number;
  error?: string;
  results?: DiscoveryResult[];
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  totalCostUsd?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  normalized?: boolean;
  webResearchUsed?: boolean;
  phase?: string;
  detail?: string;
}

interface DiscoveryJob {
  id: number;
  status: string;
  modelProvider: string | null;
  totalCompanies: number;
  completedCompanies: number;
  failedCompanies: number;
  companyNames: string;
  results: string | null;
  totalInputTokens: number | null;
  totalOutputTokens: number | null;
  totalCostUsd: number | null;
  createdAt: string;
  updatedAt: string;
}

function formatCost(cost: number): string {
  if (cost < 0.001) return `$${cost.toFixed(6)}`;
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(3)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return tokens.toString();
}

function formatElapsed(start: string, end?: string): string {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  const diffSec = Math.floor((endMs - startMs) / 1000);
  if (diffSec < 60) return `${diffSec}s`;
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function getJobDisplayStatus(job: DiscoveryJob): { label: string; variant: "default" | "secondary" | "destructive" | "outline"; isActive: boolean } {
  if (job.status === "complete") {
    return { label: "Complete", variant: "secondary", isActive: false };
  }
  if (job.status === "interrupted") {
    return { label: "Interrupted", variant: "outline", isActive: false };
  }
  if (job.status === "failed") {
    return { label: "Failed", variant: "destructive", isActive: false };
  }
  if (job.status === "running") {
    const updatedMs = new Date(job.updatedAt).getTime();
    const staleThreshold = 10 * 60 * 1000;
    if (Date.now() - updatedMs > staleThreshold) {
      return { label: "Stalled", variant: "destructive", isActive: false };
    }
    return { label: "Running", variant: "default", isActive: true };
  }
  return { label: job.status, variant: "outline", isActive: false };
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

function isIsin(value: string): boolean {
  return ISIN_RE.test(value.toUpperCase());
}

function parseTotalValue(raw: string): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[$€£¥,\s]/g, "").trim();
  if (!cleaned) return undefined;
  let multiplier = 1;
  let numStr = cleaned;
  const lastChar = cleaned.slice(-1).toUpperCase();
  if (lastChar === "B") { multiplier = 1e9; numStr = cleaned.slice(0, -1); }
  else if (lastChar === "M") { multiplier = 1e6; numStr = cleaned.slice(0, -1); }
  else if (lastChar === "K") { multiplier = 1e3; numStr = cleaned.slice(0, -1); }
  const val = parseFloat(numStr);
  if (isNaN(val) || val <= 0) return undefined;
  return val * multiplier;
}

function parseCompanyEntries(input: string): CompanyEntry[] {
  const results: CompanyEntry[] = [];
  const lines = input.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  for (const line of lines) {
    const delimiter = line.includes("\t") ? "\t" : ",";
    const parts = parseDelimitedLine(line, delimiter);

    if (parts.length >= 2) {
      const first = parts[0]?.trim();
      const second = parts[1]?.trim();
      if (first && second && isIsin(second.toUpperCase())) {
        const totalValue = parts.length >= 3 ? parseTotalValue(parts[2]) : undefined;
        results.push({ name: first, isin: second.toUpperCase(), totalValue });
        continue;
      }
      if (parts.length >= 2 && first) {
        const maybeVal = parseTotalValue(second);
        if (maybeVal) {
          results.push({ name: first, totalValue: maybeVal });
          continue;
        }
      }
    }

    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.length > 0) {
        const segments = trimmed.split(/;/).map((s) => s.trim()).filter((s) => s.length > 0);
        for (const seg of segments) {
          results.push({ name: seg });
        }
      }
    }
  }

  return results;
}

export default function Discover() {
  const { toast } = useToast();
  const [companyInput, setCompanyInput] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("openai");
  const [isRunning, setIsRunning] = useState(false);
  const [currentCompany, setCurrentCompany] = useState("");
  const [currentPhase, setCurrentPhase] = useState("");
  const [progress, setProgress] = useState({ completed: 0, failed: 0, total: 0 });
  const [results, setResults] = useState<DiscoveryResult[]>([]);
  const [isDone, setIsDone] = useState(false);
  const [runCost, setRunCost] = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: providers } = useQuery<LLMProvider[]>({
    queryKey: ["/api/llm-providers"],
  });

  const { data: serperStatus } = useQuery<{ available: boolean }>({
    queryKey: ["/api/serper/status"],
  });

  const { data: jobs } = useQuery<DiscoveryJob[]>({
    queryKey: ["/api/discover/jobs"],
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const hasActive = data.some(j => j.status === "running");
      return hasActive ? 5000 : false;
    },
  });

  const { data: expandedJob } = useQuery<DiscoveryJob>({
    queryKey: ["/api/discover/jobs", expandedJobId],
    enabled: expandedJobId !== null,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      return data.status === "running" ? 3000 : false;
    },
  });

  const entries = companyInput.trim() ? parseCompanyEntries(companyInput) : [];
  const companyCount = entries.length;
  const isinCount = entries.filter((e) => e.isin).length;
  const valueCount = entries.filter((e) => e.totalValue).length;

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length === 0) {
        toast({ title: "Empty file", description: "The uploaded file contains no data.", variant: "destructive" });
        return;
      }

      const firstLine = lines[0].toLowerCase();
      const hasHeader = firstLine.includes("company") || firstLine.includes("name") || firstLine.includes("isin");
      const dataLines = hasHeader ? lines.slice(1) : lines;

      if (dataLines.length === 0) {
        toast({ title: "No data rows", description: "The file only contains a header row.", variant: "destructive" });
        return;
      }

      const fileDelimiter = lines[0].includes("\t") ? "\t" : ",";
      const headerFields = parseDelimitedLine(lines[0], fileDelimiter);
      let nameIdx = 0;
      let isinIdx = 1;
      let valueIdx = -1;

      if (hasHeader) {
        const lowerFields = headerFields.map((f) => f.toLowerCase().replace(/[^a-z]/g, ""));
        const foundName = lowerFields.findIndex((f) => f.includes("company") || f === "name" || f.includes("companyname"));
        const foundIsin = lowerFields.findIndex((f) => f.includes("isin") || f.includes("identifier"));
        const foundValue = lowerFields.findIndex((f) => f.includes("totalvalue") || f.includes("totalasset") || f.includes("assetvalue") || f === "value" || f.includes("bookvalue") || f.includes("ppne") || f.includes("ppenet"));
        if (foundName >= 0) nameIdx = foundName;
        if (foundIsin >= 0) isinIdx = foundIsin;
        if (foundValue >= 0) valueIdx = foundValue;
      }

      const parsed = dataLines.map((line) => {
        const fields = parseDelimitedLine(line, fileDelimiter);
        const name = fields[nameIdx]?.trim() || "";
        const rawIsin = fields[isinIdx]?.trim().toUpperCase() || "";
        const rawValue = valueIdx >= 0 ? fields[valueIdx]?.trim() || "" : "";
        if (!name) return "";
        let result = name;
        if (rawIsin && isIsin(rawIsin)) {
          result += `, ${rawIsin}`;
        }
        const totalVal = parseTotalValue(rawValue);
        if (totalVal) {
          result += `, ${totalVal}`;
        }
        return result;
      }).filter(Boolean);

      setCompanyInput(parsed.join("\n"));
      setUploadedFileName(file.name);
      toast({
        title: "File loaded",
        description: `Loaded ${parsed.length} companies from ${file.name}.`,
      });
    };
    reader.readAsText(file);

    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [toast]);

  const handleClearUpload = useCallback(() => {
    setUploadedFileName(null);
    setCompanyInput("");
  }, []);

  const BATCH_SIZE = 50;

  const processBatch = useCallback(async (
    batchEntries: CompanyEntry[],
    controller: AbortController,
    cumulativeState: { completed: number; failed: number; totalCost: number; total: number },
  ): Promise<{ completed: number; failed: number; totalCost: number; batchResults: DiscoveryResult[] }> => {
    const response = await fetch("/api/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companies: batchEntries, provider: selectedProvider }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => null);
      throw new Error(errBody?.message || `Discovery request failed (${response.status})`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response stream");

    const decoder = new TextDecoder();
    let buffer = "";
    let batchCompleted = 0;
    let batchFailed = 0;
    let batchCost = 0;
    const batchResults: DiscoveryResult[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event: DiscoveryEvent = JSON.parse(line.slice(6));

          switch (event.type) {
            case "processing":
              setCurrentCompany(event.company || "");
              setCurrentPhase("");
              break;
            case "phase":
              setCurrentPhase(event.detail || event.phase || "");
              break;
            case "completed": {
              batchCompleted = event.completed || 0;
              batchFailed = event.failed || 0;
              batchCost = event.totalCostUsd || 0;
              const result: DiscoveryResult = {
                name: event.company || "",
                status: "success",
                assetsFound: event.assetsFound,
                inputTokens: event.inputTokens,
                outputTokens: event.outputTokens,
                costUsd: event.costUsd,
                normalized: event.normalized,
                webResearchUsed: event.webResearchUsed,
              };
              batchResults.push(result);
              setResults((prev) => [...prev, result]);
              setProgress({
                completed: cumulativeState.completed + batchCompleted,
                failed: cumulativeState.failed + batchFailed,
                total: cumulativeState.total,
              });
              setRunCost(cumulativeState.totalCost + batchCost);
              break;
            }
            case "error": {
              batchCompleted = event.completed || 0;
              batchFailed = event.failed || 0;
              const errResult: DiscoveryResult = { name: event.company || "", status: "failed", error: event.error };
              batchResults.push(errResult);
              setResults((prev) => [...prev, errResult]);
              setProgress({
                completed: cumulativeState.completed + batchCompleted,
                failed: cumulativeState.failed + batchFailed,
                total: cumulativeState.total,
              });
              break;
            }
            case "done":
              batchCompleted = event.completed || 0;
              batchFailed = event.failed || 0;
              batchCost = event.totalCostUsd || 0;
              break;
            case "fatal_error":
              throw new Error(event.error || "Fatal error during discovery batch");
          }
        } catch (batchErr) {
          if (batchErr instanceof Error) throw batchErr;
        }
      }
    }

    return {
      completed: batchCompleted,
      failed: batchFailed,
      totalCost: batchCost,
      batchResults,
    };
  }, [selectedProvider]);

  const handleDiscover = useCallback(async () => {
    if (entries.length === 0) {
      toast({ title: "No companies entered", description: "Please enter at least one company name.", variant: "destructive" });
      return;
    }

    setIsRunning(true);
    setResults([]);
    setProgress({ completed: 0, failed: 0, total: entries.length });
    setCurrentCompany("");
    setCurrentPhase("");
    setIsDone(false);
    setRunCost(0);

    const controller = new AbortController();
    abortRef.current = controller;

    const batches: CompanyEntry[][] = [];
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      batches.push(entries.slice(i, i + BATCH_SIZE));
    }

    let cumulativeCompleted = 0;
    let cumulativeFailed = 0;
    let cumulativeCost = 0;

    try {
      if (batches.length > 1) {
        setCurrentPhase(`Processing in ${batches.length} batches of up to ${BATCH_SIZE} companies...`);
      }

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        if (controller.signal.aborted) break;

        if (batches.length > 1) {
          setCurrentPhase(`Starting batch ${batchIdx + 1} of ${batches.length}...`);
        }

        try {
          const batchResult = await processBatch(
            batches[batchIdx],
            controller,
            { completed: cumulativeCompleted, failed: cumulativeFailed, totalCost: cumulativeCost, total: entries.length },
          );

          cumulativeCompleted += batchResult.completed;
          cumulativeFailed += batchResult.failed;
          cumulativeCost += batchResult.totalCost;
        } catch (batchErr) {
          if (controller.signal.aborted) break;
          if ((batchErr as Error).name === "AbortError") break;
          const batchSize = batches[batchIdx].length;
          cumulativeFailed += batchSize;
          setProgress({
            completed: cumulativeCompleted,
            failed: cumulativeFailed,
            total: entries.length,
          });
          console.error(`Batch ${batchIdx + 1} failed:`, batchErr);
          const batchErrMsg = (batchErr as Error).message || "Unknown error";
          for (const entry of batches[batchIdx]) {
            setResults(prev => [...prev, { name: entry.name, status: "failed", error: `Batch error: ${batchErrMsg}` }]);
          }
          toast({
            title: `Batch ${batchIdx + 1} failed`,
            description: `${batchErrMsg}. Continuing to next batch...`,
            variant: "destructive",
          });
        }

        if (batchIdx < batches.length - 1 && !controller.signal.aborted) {
          setCurrentPhase(`Batch ${batchIdx + 1} complete. Starting next batch in 2s...`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      setCurrentCompany("");
      setCurrentPhase("");
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/discover/jobs"] });

      if (controller.signal.aborted) {
        setRunCost(cumulativeCost);
        toast({
          title: "Discovery cancelled",
          description: `Stopped after ${cumulativeCompleted + cumulativeFailed} of ${entries.length} companies. ${cumulativeCompleted} succeeded, ${cumulativeFailed} failed. Completed companies are saved.`,
        });
      } else {
        setIsDone(true);
        setRunCost(cumulativeCost);
        toast({
          title: "Discovery complete",
          description: `Processed ${entries.length} companies: ${cumulativeCompleted} succeeded, ${cumulativeFailed} failed. Cost: ${formatCost(cumulativeCost)}`,
        });
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const errMsg = (err as Error).message || "";
        const isNetworkError = errMsg.includes("Failed to fetch") || errMsg.includes("network") || errMsg.includes("TypeError");
        toast({
          title: "Discovery failed",
          description: isNetworkError
            ? "Connection lost. The server may have timed out. Check results so far — completed companies are saved."
            : errMsg || "An error occurred during discovery.",
          variant: "destructive",
        });
      }
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [entries, selectedProvider, toast, processBatch]);

  const progressPercent = progress.total > 0 ? ((progress.completed + progress.failed) / progress.total) * 100 : 0;

  const currentProvider = providers?.find((p) => p.id === selectedProvider);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 h-14">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon" data-testid="button-back-dashboard">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <Sparkles className="w-5 h-5 text-chart-1" />
              <h1 className="text-base font-semibold tracking-tight">Discover Companies</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Company Input</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter companies below (one per line) or upload a CSV file. Include ISIN codes for more accurate identification and total asset values for normalization. Format: <span className="font-mono text-xs">Company Name, ISIN, TotalValue</span>
              </p>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">AI Model</label>
                <Select
                  value={selectedProvider}
                  onValueChange={setSelectedProvider}
                  disabled={isRunning}
                >
                  <SelectTrigger data-testid="select-model-provider">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers?.map((p) => (
                      <SelectItem
                        key={p.id}
                        value={p.id}
                        disabled={!p.available}
                        data-testid={`option-provider-${p.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <Brain className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{p.name}</span>
                          {!p.available && <span className="text-xs text-muted-foreground">(no key)</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {currentProvider && (
                  <p className="text-xs text-muted-foreground">
                    Est. cost: {formatCost(currentProvider.costPer1kInputTokens)}/1k input + {formatCost(currentProvider.costPer1kOutputTokens)}/1k output tokens
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 rounded-md border p-2">
                <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground">Web Research:</span>
                {serperStatus?.available ? (
                  <Badge variant="secondary" data-testid="badge-serper-active">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" data-testid="badge-serper-inactive">
                    Off
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {serperStatus?.available
                    ? "Results grounded with live web data"
                    : "Add SERPER_API_KEY for web-enhanced discovery"}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Companies</label>
                  <div className="flex items-center gap-2">
                    {uploadedFileName && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <FileText className="w-3 h-3" />
                        <span className="truncate max-w-[120px]">{uploadedFileName}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={handleClearUpload}
                          disabled={isRunning}
                          data-testid="button-clear-upload"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt,.tsv"
                      className="hidden"
                      onChange={handleFileUpload}
                      data-testid="input-file-upload"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isRunning}
                      data-testid="button-upload-csv"
                    >
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                      Upload CSV
                    </Button>
                  </div>
                </div>
                <Textarea
                  placeholder={"Enter companies, one per line (optionally with ISIN and total asset value):\nApple Inc, US0378331005, 43.7B\nSamsung Electronics, KR7005930003, 120000000000\nNovartis\nSiemens AG, DE0007236101, 25B\nBHP Group, AU000000BHP4, $32.5B"}
                  value={companyInput}
                  onChange={(e) => {
                    setCompanyInput(e.target.value);
                    setUploadedFileName(null);
                  }}
                  className="min-h-[160px] text-sm font-mono resize-none"
                  disabled={isRunning}
                  data-testid="input-company-names"
                />
              </div>

              <div className="flex items-center justify-between gap-4 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {companyCount} {companyCount === 1 ? "company" : "companies"}
                  {isinCount > 0 && ` (${isinCount} with ISIN)`}
                  {valueCount > 0 && ` (${valueCount} with total value)`}
                </span>
                <Button
                  onClick={handleDiscover}
                  disabled={isRunning || companyCount === 0}
                  data-testid="button-start-discovery"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Discovering...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                      Discover Assets
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Discovery Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isRunning && results.length === 0 && !isDone && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="w-8 h-8 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Enter company names and click "Discover Assets" to begin.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Each company takes about 20-30 seconds (2-pass deep analysis).
                  </p>
                </div>
              )}

              {(isRunning || results.length > 0) && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {progress.completed + progress.failed} of {progress.total} companies
                      </span>
                      <div className="flex items-center gap-3">
                        {runCost > 0 && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {formatCost(runCost)}
                          </span>
                        )}
                        <span>{Math.round(progressPercent)}%</span>
                      </div>
                    </div>
                    <Progress value={progressPercent} className="h-2" data-testid="progress-bar" />
                  </div>

                  {currentCompany && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-chart-1" />
                        <span className="text-muted-foreground">Researching:</span>
                        <span className="font-medium" data-testid="text-current-company">{currentCompany}</span>
                      </div>
                      {currentPhase && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pl-5" data-testid="text-current-phase">
                          <span>{currentPhase}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {results.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                        data-testid={`result-row-${i}`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {r.status === "success" ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span className="text-sm font-medium truncate block">{r.name}</span>
                            {r.status === "failed" && r.error && (
                              <span className="text-xs text-red-500 dark:text-red-400 truncate block" data-testid={`text-error-${i}`}>{r.error}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {r.status === "success" && r.webResearchUsed && (
                            <Badge variant="outline" data-testid={`badge-web-research-${i}`}>
                              <Globe className="w-3 h-3 mr-1" />
                              Web
                            </Badge>
                          )}
                          {r.status === "success" && r.normalized && (
                            <Badge variant="outline" data-testid={`badge-normalized-${i}`}>Normalized</Badge>
                          )}
                          {r.status === "success" && r.costUsd !== undefined && (
                            <span className="text-xs text-muted-foreground font-mono">{formatCost(r.costUsd)}</span>
                          )}
                          {r.status === "success" && r.inputTokens !== undefined && (
                            <span className="text-xs text-muted-foreground font-mono" data-testid={`text-tokens-${i}`}>
                              {formatTokens((r.inputTokens || 0) + (r.outputTokens || 0))} tok
                            </span>
                          )}
                          {r.status === "success" ? (
                            <Badge variant="secondary">{r.assetsFound} assets</Badge>
                          ) : (
                            <Badge variant="destructive">Failed</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {isDone && (
                    <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
                      <p className="font-medium">Discovery Complete</p>
                      <p className="text-muted-foreground mt-1">
                        {progress.completed} companies discovered with their assets.{" "}
                        {progress.failed > 0 && `${progress.failed} failed. `}
                        Total cost: {formatCost(runCost)}.{" "}
                        <Link href="/" className="text-chart-1 underline underline-offset-2">
                          View dashboard
                        </Link>
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {jobs && jobs.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Zap className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Discovery History</CardTitle>
              {jobs.some(j => j.status === "running") && (
                <Badge variant="default" className="ml-auto animate-pulse" data-testid="badge-jobs-active">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Active
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left">
                      <th className="px-3 py-2 text-xs font-medium">Date</th>
                      <th className="px-3 py-2 text-xs font-medium">Model</th>
                      <th className="px-3 py-2 text-xs font-medium">Companies</th>
                      <th className="px-3 py-2 text-xs font-medium">Status</th>
                      <th className="px-3 py-2 text-xs font-medium">Progress</th>
                      <th className="px-3 py-2 text-xs font-medium text-right">Duration</th>
                      <th className="px-3 py-2 text-xs font-medium text-right">Tokens</th>
                      <th className="px-3 py-2 text-xs font-medium text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {jobs.map((job) => {
                      const names: string[] = (() => {
                        try { return JSON.parse(job.companyNames); } catch { return []; }
                      })();
                      const providerName = providers?.find((p) => p.id === job.modelProvider)?.name || job.modelProvider || "OpenAI";
                      const displayStatus = getJobDisplayStatus(job);
                      const processed = job.completedCompanies + job.failedCompanies;
                      const jobProgress = job.totalCompanies > 0 ? (processed / job.totalCompanies) * 100 : 0;
                      const isFinished = job.status === "complete" || job.status === "interrupted" || job.status === "failed";
                      const isExpanded = expandedJobId === job.id;
                      const detailJob = isExpanded && expandedJob ? expandedJob : job;
                      const jobResults: DiscoveryResult[] = (() => {
                        try { return detailJob.results ? JSON.parse(detailJob.results) : []; } catch { return []; }
                      })();
                      const completedNames = new Set(jobResults.map((r: DiscoveryResult) => r.name));
                      const pendingNames = names.filter(n => !completedNames.has(n));

                      return (
                        <Fragment key={job.id}>
                          <tr
                            data-testid={`row-job-${job.id}`}
                            className={`cursor-pointer hover:bg-muted/30 transition-colors ${displayStatus.isActive ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
                            onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                          >
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                {isExpanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                                <span>
                                  {new Date(job.createdAt).toLocaleDateString()}{" "}
                                  <span className="text-xs">{new Date(job.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant="outline" data-testid={`badge-model-${job.id}`}>{providerName}</Badge>
                            </td>
                            <td className="px-3 py-2">
                              <span className="font-mono text-xs">{job.totalCompanies}</span>
                              <span className="text-muted-foreground text-xs ml-1">
                                ({names.slice(0, 2).join(", ")}{names.length > 2 ? ` +${names.length - 2}` : ""})
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant={displayStatus.variant} data-testid={`badge-status-${job.id}`}>
                                {displayStatus.isActive && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                                {displayStatus.label}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 min-w-[140px]">
                              <div className="flex items-center gap-2">
                                <Progress value={jobProgress} className="h-2 flex-1" />
                                <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                                  {job.completedCompanies}/{job.totalCompanies}
                                  {job.failedCompanies > 0 && (
                                    <span className="text-red-500"> ({job.failedCompanies}✗)</span>
                                  )}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-muted-foreground text-xs whitespace-nowrap" data-testid={`text-duration-${job.id}`}>
                              {formatElapsed(job.createdAt, isFinished ? job.updatedAt : undefined)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                              {job.totalInputTokens || job.totalOutputTokens
                                ? formatTokens((job.totalInputTokens || 0) + (job.totalOutputTokens || 0))
                                : "-"}
                            </td>
                            <td className="px-3 py-2 text-right font-mono" data-testid={`text-cost-${job.id}`}>
                              {job.totalCostUsd ? formatCost(job.totalCostUsd) : "-"}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${job.id}-detail`}>
                              <td colSpan={8} className="p-0">
                                <div className="bg-muted/20 border-t border-border px-4 py-3 space-y-3">
                                  {displayStatus.isActive && (
                                    <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Live — refreshing every 3 seconds</span>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      Started: {new Date(job.createdAt).toLocaleString()}
                                    </span>
                                    <span>Duration: {formatElapsed(job.createdAt, isFinished ? job.updatedAt : undefined)}</span>
                                    {detailJob.totalCostUsd ? <span>Total cost: {formatCost(detailJob.totalCostUsd)}</span> : null}
                                  </div>

                                  <div className="space-y-1 max-h-[400px] overflow-y-auto">
                                    {jobResults.map((r: DiscoveryResult, i: number) => (
                                      <div
                                        key={i}
                                        className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-1.5"
                                        data-testid={`detail-result-${job.id}-${i}`}
                                      >
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          {r.status === "success" ? (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
                                          ) : (
                                            <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                          )}
                                          <span className="text-sm truncate">{r.name}</span>
                                          {r.status === "failed" && r.error && (
                                            <span className="text-xs text-red-500 truncate ml-1">— {r.error}</span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          {r.webResearchUsed && (
                                            <Badge variant="outline" className="text-[10px] h-5">
                                              <Globe className="w-2.5 h-2.5 mr-0.5" />
                                              Web
                                            </Badge>
                                          )}
                                          {r.normalized && (
                                            <Badge variant="outline" className="text-[10px] h-5">Norm</Badge>
                                          )}
                                          {r.costUsd !== undefined && (
                                            <span className="text-xs text-muted-foreground font-mono">{formatCost(r.costUsd)}</span>
                                          )}
                                          {r.status === "success" && (
                                            <Badge variant="secondary" className="text-[10px] h-5">{r.assetsFound} assets</Badge>
                                          )}
                                        </div>
                                      </div>
                                    ))}

                                    {displayStatus.isActive && pendingNames.length > 0 && (
                                      <>
                                        <div className="flex items-center gap-2 rounded-md border border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/30 px-3 py-1.5">
                                          <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" />
                                          <span className="text-sm text-blue-700 dark:text-blue-300">{pendingNames[0]}</span>
                                          <span className="text-xs text-blue-500 ml-auto">Processing...</span>
                                        </div>
                                        {pendingNames.slice(1, 6).map((name, i) => (
                                          <div
                                            key={`pending-${i}`}
                                            className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-1.5 opacity-50"
                                          >
                                            <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-sm text-muted-foreground">{name}</span>
                                            <span className="text-xs text-muted-foreground ml-auto">Queued</span>
                                          </div>
                                        ))}
                                        {pendingNames.length > 6 && (
                                          <div className="text-xs text-muted-foreground text-center py-1">
                                            +{pendingNames.length - 6} more companies queued
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>

                                  {jobResults.length === 0 && !displayStatus.isActive && (
                                    <div className="text-sm text-muted-foreground text-center py-2">
                                      No company results recorded for this job.
                                    </div>
                                  )}

                                  {!displayStatus.isActive && !isRunning && (() => {
                                    const failedResults = jobResults.filter((r: DiscoveryResult) => r.status === "failed");
                                    const completedResultNames = new Set(jobResults.map((r: DiscoveryResult) => r.name));
                                    const unprocessed = names.filter(n => !completedResultNames.has(n));
                                    const retryCompanies = [...failedResults.map((r: DiscoveryResult) => r.name), ...unprocessed];
                                    if (retryCompanies.length === 0) return null;

                                    const handleRetry = () => {
                                      setCompanyInput(retryCompanies.join("\n"));
                                      if (job.modelProvider) setSelectedProvider(job.modelProvider);
                                      setExpandedJobId(null);
                                      window.scrollTo({ top: 0, behavior: "smooth" });
                                      toast({
                                        title: `${retryCompanies.length} companies loaded`,
                                        description: `${failedResults.length} failed + ${unprocessed.length} unprocessed companies ready to retry.`,
                                      });
                                    };

                                    return (
                                      <div className="flex items-center justify-between pt-2 border-t border-border">
                                        <span className="text-xs text-muted-foreground">
                                          {failedResults.length > 0 && `${failedResults.length} failed`}
                                          {failedResults.length > 0 && unprocessed.length > 0 && ", "}
                                          {unprocessed.length > 0 && `${unprocessed.length} unprocessed`}
                                        </span>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={(e) => { e.stopPropagation(); handleRetry(); }}
                                          data-testid={`button-retry-${job.id}`}
                                        >
                                          <AlertCircle className="w-3.5 h-3.5 mr-1" />
                                          {unprocessed.length > 0 ? "Resume & Retry" : "Retry Failed"}
                                          {" "}({retryCompanies.length})
                                        </Button>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
