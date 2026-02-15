import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
} from "lucide-react";
import { Link } from "wouter";

interface DiscoveryResult {
  name: string;
  status: string;
  assetsFound?: number;
  error?: string;
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
}

export default function Discover() {
  const { toast } = useToast();
  const [companyInput, setCompanyInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [currentCompany, setCurrentCompany] = useState("");
  const [progress, setProgress] = useState({ completed: 0, failed: 0, total: 0 });
  const [results, setResults] = useState<DiscoveryResult[]>([]);
  const [isDone, setIsDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const { data: jobs } = useQuery<Array<{
    id: number;
    status: string;
    totalCompanies: number;
    completedCompanies: number;
    failedCompanies: number;
    companyNames: string;
    results: string | null;
    createdAt: string;
  }>>({
    queryKey: ["/api/discover/jobs"],
  });

  const parseCompanyNames = useCallback((input: string): string[] => {
    return input
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, []);

  const companyCount = companyInput.trim() ? parseCompanyNames(companyInput).length : 0;

  const handleDiscover = useCallback(async () => {
    const names = parseCompanyNames(companyInput);
    if (names.length === 0) {
      toast({ title: "No companies entered", description: "Please enter at least one company name.", variant: "destructive" });
      return;
    }

    setIsRunning(true);
    setResults([]);
    setProgress({ completed: 0, failed: 0, total: names.length });
    setCurrentCompany("");
    setIsDone(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companies: names }),
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
                setResults((prev) => [...prev, { name: event.company || "", status: "success", assetsFound: event.assetsFound }]);
                setProgress({ completed: event.completed || 0, failed: event.failed || 0, total: event.total || 0 });
                break;
              case "error":
                setResults((prev) => [...prev, { name: event.company || "", status: "failed", error: event.error }]);
                setProgress({ completed: event.completed || 0, failed: event.failed || 0, total: event.total || 0 });
                break;
              case "done":
                setIsDone(true);
                setCurrentCompany("");
                queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
                queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
                queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
                queryClient.invalidateQueries({ queryKey: ["/api/discover/jobs"] });
                toast({
                  title: "Discovery complete",
                  description: `Processed ${event.total} companies: ${event.completed} succeeded, ${event.failed} failed.`,
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
  }, [companyInput, parseCompanyNames, toast]);

  const progressPercent = progress.total > 0 ? ((progress.completed + progress.failed) / progress.total) * 100 : 0;

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
              <CardTitle className="text-sm font-medium">Company Names</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter company names below, one per line or separated by commas. The AI will research each company and discover their physical assets, locations, and estimated valuations.
              </p>
              <Textarea
                placeholder={"Enter company names, one per line:\nGoogle\nSamsung Electronics\nNovartis\nSiemens AG\nBHP Group"}
                value={companyInput}
                onChange={(e) => setCompanyInput(e.target.value)}
                className="min-h-[200px] text-sm font-mono resize-none"
                disabled={isRunning}
                data-testid="input-company-names"
              />
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {companyCount} {companyCount === 1 ? "company" : "companies"} entered
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
                      <span>{Math.round(progressPercent)}%</span>
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
                        <div className="shrink-0">
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
                        {progress.failed > 0 && `${progress.failed} failed.`}{" "}
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
            <CardHeader>
              <CardTitle className="text-sm font-medium">Discovery History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left">
                      <th className="px-3 py-2 text-xs font-medium">Date</th>
                      <th className="px-3 py-2 text-xs font-medium">Companies</th>
                      <th className="px-3 py-2 text-xs font-medium">Status</th>
                      <th className="px-3 py-2 text-xs font-medium text-right">Succeeded</th>
                      <th className="px-3 py-2 text-xs font-medium text-right">Failed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {jobs.map((job) => {
                      const names = (() => {
                        try { return JSON.parse(job.companyNames); } catch { return []; }
                      })();
                      return (
                        <tr key={job.id} data-testid={`row-job-${job.id}`}>
                          <td className="px-3 py-2 text-muted-foreground">
                            {new Date(job.createdAt).toLocaleDateString()}
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
