import { useState, useRef, useCallback } from "react";
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
}

interface DiscoveryResult {
  name: string;
  status: string;
  assetsFound?: number;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
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
        results.push({ name: first, isin: second.toUpperCase() });
        continue;
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
  const [progress, setProgress] = useState({ completed: 0, failed: 0, total: 0 });
  const [results, setResults] = useState<DiscoveryResult[]>([]);
  const [isDone, setIsDone] = useState(false);
  const [runCost, setRunCost] = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: providers } = useQuery<LLMProvider[]>({
    queryKey: ["/api/llm-providers"],
  });

  const { data: jobs } = useQuery<DiscoveryJob[]>({
    queryKey: ["/api/discover/jobs"],
  });

  const entries = companyInput.trim() ? parseCompanyEntries(companyInput) : [];
  const companyCount = entries.length;
  const isinCount = entries.filter((e) => e.isin).length;

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

      if (hasHeader) {
        const lowerFields = headerFields.map((f) => f.toLowerCase().replace(/[^a-z]/g, ""));
        const foundName = lowerFields.findIndex((f) => f.includes("company") || f === "name" || f.includes("companyname"));
        const foundIsin = lowerFields.findIndex((f) => f.includes("isin") || f.includes("identifier"));
        if (foundName >= 0) nameIdx = foundName;
        if (foundIsin >= 0) isinIdx = foundIsin;
      }

      const parsed = dataLines.map((line) => {
        const fields = parseDelimitedLine(line, fileDelimiter);
        const name = fields[nameIdx]?.trim() || "";
        const rawIsin = fields[isinIdx]?.trim().toUpperCase() || "";
        if (!name) return "";
        if (rawIsin && isIsin(rawIsin)) {
          return `${name}, ${rawIsin}`;
        }
        return name;
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

  const handleDiscover = useCallback(async () => {
    if (entries.length === 0) {
      toast({ title: "No companies entered", description: "Please enter at least one company name.", variant: "destructive" });
      return;
    }

    setIsRunning(true);
    setResults([]);
    setProgress({ completed: 0, failed: 0, total: entries.length });
    setCurrentCompany("");
    setIsDone(false);
    setRunCost(0);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companies: entries, provider: selectedProvider }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Discovery request failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

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
                break;
              case "completed":
                setResults((prev) => [...prev, {
                  name: event.company || "",
                  status: "success",
                  assetsFound: event.assetsFound,
                  inputTokens: event.inputTokens,
                  outputTokens: event.outputTokens,
                  costUsd: event.costUsd,
                }]);
                setProgress({ completed: event.completed || 0, failed: event.failed || 0, total: event.total || 0 });
                setRunCost(event.totalCostUsd || 0);
                break;
              case "error":
                setResults((prev) => [...prev, { name: event.company || "", status: "failed", error: event.error }]);
                setProgress({ completed: event.completed || 0, failed: event.failed || 0, total: event.total || 0 });
                break;
              case "done":
                setIsDone(true);
                setCurrentCompany("");
                setRunCost(event.totalCostUsd || 0);
                queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
                queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
                queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
                queryClient.invalidateQueries({ queryKey: ["/api/discover/jobs"] });
                toast({
                  title: "Discovery complete",
                  description: `Processed ${event.total} companies: ${event.completed} succeeded, ${event.failed} failed. Cost: ${formatCost(event.totalCostUsd || 0)}`,
                });
                break;
            }
          } catch {
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast({ title: "Discovery failed", description: "An error occurred during discovery.", variant: "destructive" });
      }
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [entries, selectedProvider, toast]);

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
                Enter companies below (one per line) or upload a CSV file. Include ISIN codes for more accurate identification. Format: <span className="font-mono text-xs">Company Name, ISIN</span>
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
                  placeholder={"Enter companies, one per line (optionally with ISIN):\nApple Inc, US0378331005\nSamsung Electronics, KR7005930003\nNovartis\nSiemens AG, DE0007236101\nBHP Group, AU000000BHP4"}
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
                    Each company takes about 10-15 seconds to research.
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
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-chart-1" />
                      <span className="text-muted-foreground">Researching:</span>
                      <span className="font-medium" data-testid="text-current-company">{currentCompany}</span>
                    </div>
                  )}

                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {results.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                        data-testid={`result-row-${i}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {r.status === "success" ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                          )}
                          <span className="text-sm font-medium truncate">{r.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
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
                      <th className="px-3 py-2 text-xs font-medium text-right">Succeeded</th>
                      <th className="px-3 py-2 text-xs font-medium text-right">Failed</th>
                      <th className="px-3 py-2 text-xs font-medium text-right">Tokens</th>
                      <th className="px-3 py-2 text-xs font-medium text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {jobs.map((job) => {
                      const names = (() => {
                        try { return JSON.parse(job.companyNames); } catch { return []; }
                      })();
                      const providerName = providers?.find((p) => p.id === job.modelProvider)?.name || job.modelProvider || "OpenAI";
                      return (
                        <tr key={job.id} data-testid={`row-job-${job.id}`}>
                          <td className="px-3 py-2 text-muted-foreground">
                            {new Date(job.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" data-testid={`badge-model-${job.id}`}>{providerName}</Badge>
                          </td>
                          <td className="px-3 py-2">
                            {names.slice(0, 3).join(", ")}{names.length > 3 ? ` +${names.length - 3} more` : ""}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={job.status === "complete" ? "secondary" : "outline"}>
                              {job.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{job.completedCompanies}</td>
                          <td className="px-3 py-2 text-right font-mono">{job.failedCompanies}</td>
                          <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                            {job.totalInputTokens || job.totalOutputTokens
                              ? formatTokens((job.totalInputTokens || 0) + (job.totalOutputTokens || 0))
                              : "-"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono" data-testid={`text-cost-${job.id}`}>
                            {job.totalCostUsd ? formatCost(job.totalCostUsd) : "-"}
                          </td>
                        </tr>
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
