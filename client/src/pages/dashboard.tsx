import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useRef } from "react";
import { StatsCards } from "@/components/stats-cards";
import { CompanySelector } from "@/components/company-selector";
import { AssetTable } from "@/components/asset-table";
import { CompanyDetail } from "@/components/company-detail";
import { SectorValueChart, TopCompaniesChart } from "@/components/sector-chart";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Download, Search, Database, BarChart3, Building2, Table2, Sparkles, BookOpen, Upload, DollarSign, Loader2, CheckCircle2, X } from "lucide-react";
import type { Asset, Company } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { queryClient } from "@/lib/queryClient";

interface UpdateResult {
  isin: string;
  company: string;
  oldValue: number;
  newValue: number;
  assetsScaled: number;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuotes = !inQuotes; continue; }
    if (line[i] === "," && !inQuotes) { fields.push(current); current = ""; continue; }
    current += line[i];
  }
  fields.push(current);
  return fields;
}

function formatCurrency(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

export default function Dashboard() {
  const { toast } = useToast();
  const [selectedCompany, setSelectedCompany] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [showUpdateValues, setShowUpdateValues] = useState(false);
  const [updateRunning, setUpdateRunning] = useState(false);
  const [updateResults, setUpdateResults] = useState<{ updated: number; skipped: number; errors: number; results: UpdateResult[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: assetsResponse, isLoading: assetsLoading } = useQuery<{
    total_assets: number;
    assets_with_coordinates: number;
    coordinate_coverage_percent: string;
    assets: Asset[];
  }>({
    queryKey: ["/api/assets"],
  });

  const { data: companiesResponse, isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const allAssets = assetsResponse?.assets || [];
  const companies = companiesResponse || [];

  const stats = useMemo(() => {
    if (!allAssets.length) return null;
    const countriesSet = new Set(allAssets.map((a) => a.country).filter(Boolean));
    const assetsWithCoords = allAssets.filter((a) => a.latitude && a.longitude).length;
    const totalValue = allAssets.reduce((sum, a) => sum + (a.valueUsd || 0), 0);
    const companiesSet = new Set(allAssets.map((a) => a.companyName));
    return {
      totalCompanies: companiesSet.size,
      totalAssets: allAssets.length,
      assetsWithCoords,
      totalValue,
      countriesCount: countriesSet.size,
      avgAssetsPerCompany: companiesSet.size > 0 ? allAssets.length / companiesSet.size : 0,
    };
  }, [allAssets]);

  const companyAssets = useMemo(() => {
    if (!selectedCompany) return [];
    return allAssets.filter((a) => a.companyName === selectedCompany);
  }, [allAssets, selectedCompany]);

  const filteredAssets = useMemo(() => {
    if (!globalSearch) return allAssets;
    const lower = globalSearch.toLowerCase();
    return allAssets.filter(
      (a) =>
        a.facilityName.toLowerCase().includes(lower) ||
        a.companyName.toLowerCase().includes(lower) ||
        (a.city && a.city.toLowerCase().includes(lower)) ||
        (a.country && a.country.toLowerCase().includes(lower)) ||
        (a.assetType && a.assetType.toLowerCase().includes(lower))
    );
  }, [allAssets, globalSearch]);

  const companyList = useMemo(() => {
    return companies.map((c) => ({
      isin: c.isin,
      name: c.name,
      sector: c.sector,
    }));
  }, [companies]);

  const handleExportCSV = async () => {
    try {
      const res = await fetch("/api/assets/export/csv");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "corporate_assets.csv";
      a.click();
      window.URL.revokeObjectURL(url);
      toast({ title: "Export complete", description: "CSV file downloaded successfully." });
    } catch {
      toast({ title: "Export failed", description: "Could not export CSV file.", variant: "destructive" });
    }
  };

  const handleUpdateValuesFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) {
        toast({ title: "Empty file", description: "The CSV file contains no data rows.", variant: "destructive" });
        return;
      }

      const header = parseCSVLine(lines[0]);
      const isinIdx = header.findIndex((h) => h.trim().toUpperCase() === "ISIN");
      const tvIdx = header.findIndex((h) => h.trim().toUpperCase() === "TOTALVALUE");

      if (isinIdx < 0 || tvIdx < 0) {
        toast({
          title: "Invalid CSV format",
          description: "CSV must have 'ISIN' and 'TotalValue' columns in the header row.",
          variant: "destructive",
        });
        return;
      }

      const entries: Array<{ isin: string; totalValue: number }> = [];
      for (const line of lines.slice(1)) {
        const fields = parseCSVLine(line);
        const isin = (fields[isinIdx] || "").trim();
        const rawVal = (fields[tvIdx] || "").replace(/,/g, "").trim();
        const totalValue = parseFloat(rawVal);
        if (isin && !isNaN(totalValue) && totalValue > 0) {
          entries.push({ isin, totalValue });
        }
      }

      if (entries.length === 0) {
        toast({ title: "No valid entries", description: "No rows with valid ISIN and TotalValue found.", variant: "destructive" });
        return;
      }

      setUpdateRunning(true);
      setUpdateResults(null);

      try {
        const res = await fetch("/api/companies/update-values", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || "Update failed");
        }

        const result = await res.json();
        setUpdateResults(result);

        queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
        queryClient.invalidateQueries({ queryKey: ["/api/companies"] });

        toast({
          title: "Values updated",
          description: `Updated ${result.updated} companies (${result.skipped} skipped, ${result.errors} errors).`,
        });
      } catch (err: any) {
        toast({ title: "Update failed", description: err.message, variant: "destructive" });
      } finally {
        setUpdateRunning(false);
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 h-14">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-chart-1" />
              <h1 className="text-base font-semibold tracking-tight">Corporate Asset Database</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setShowUpdateValues(!showUpdateValues); setUpdateResults(null); }}
                data-testid="button-update-values"
              >
                <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                Update Values
              </Button>
              <Link href="/discover">
                <Button variant="outline" size="sm" data-testid="button-discover">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Discover
                </Button>
              </Link>
              <Link href="/methodology">
                <Button variant="outline" size="sm" data-testid="button-methodology">
                  <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                  Methodology
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={handleExportCSV} data-testid="button-export-csv">
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Export CSV
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {showUpdateValues && (
          <Card data-testid="panel-update-values">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-chart-1" />
                  <h3 className="text-sm font-semibold">Update Company Total Values</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setShowUpdateValues(false); setUpdateResults(null); }} data-testid="button-close-update-values">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Upload a CSV file with <span className="font-mono">ISIN</span> and <span className="font-mono">TotalValue</span> columns.
                This will update the total asset value for each matching company and proportionally rescale all individual asset values.
                No assets will be re-extracted — only values are updated.
              </p>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleUpdateValuesFile}
                  data-testid="input-update-values-file"
                />
                <Button
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={updateRunning}
                  data-testid="button-upload-values"
                >
                  {updateRunning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                      Upload CSV
                    </>
                  )}
                </Button>
              </div>

              {updateResults && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <strong>{updateResults.updated}</strong> updated
                    </span>
                    <span className="text-muted-foreground">{updateResults.skipped} skipped (no match)</span>
                    {updateResults.errors > 0 && (
                      <span className="text-red-500">{updateResults.errors} errors</span>
                    )}
                  </div>

                  {updateResults.results.length > 0 && (
                    <div className="rounded-md border border-border overflow-hidden max-h-[300px] overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/50 text-left sticky top-0">
                            <th className="px-3 py-1.5 font-medium">Company</th>
                            <th className="px-3 py-1.5 font-medium">ISIN</th>
                            <th className="px-3 py-1.5 font-medium text-right">Previous Value</th>
                            <th className="px-3 py-1.5 font-medium text-right">New Value</th>
                            <th className="px-3 py-1.5 font-medium text-right">Assets Scaled</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {updateResults.results.map((r) => (
                            <tr key={r.isin} data-testid={`row-update-result-${r.isin}`}>
                              <td className="px-3 py-1.5">{r.company}</td>
                              <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.isin}</td>
                              <td className="px-3 py-1.5 text-right font-mono tabular-nums">{formatCurrency(r.oldValue)}</td>
                              <td className="px-3 py-1.5 text-right font-mono tabular-nums">{formatCurrency(r.newValue)}</td>
                              <td className="px-3 py-1.5 text-right">{r.assetsScaled}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <StatsCards stats={stats} isLoading={assetsLoading} />

        <div className="flex items-center gap-3 flex-wrap">
          <CompanySelector
            companies={companyList}
            selectedCompany={selectedCompany}
            onSelect={(c) => {
              setSelectedCompany(c);
              if (c) setActiveTab("company");
            }}
            isLoading={companiesLoading}
          />
          {!selectedCompany && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search all assets..."
                className="pl-8"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                data-testid="input-global-search"
              />
            </div>
          )}
        </div>

        {selectedCompany ? (
          <CompanyDetail companyName={selectedCompany} assets={companyAssets} />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList data-testid="tabs-view">
              <TabsTrigger value="overview" data-testid="tab-overview">
                <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="assets" data-testid="tab-assets">
                <Table2 className="w-3.5 h-3.5 mr-1.5" />
                All Assets
              </TabsTrigger>
              <TabsTrigger value="companies" data-testid="tab-companies">
                <Building2 className="w-3.5 h-3.5 mr-1.5" />
                Companies
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SectorValueChart assets={allAssets} />
                <TopCompaniesChart assets={allAssets} />
              </div>
            </TabsContent>

            <TabsContent value="assets" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
                    <h3 className="text-sm font-medium">
                      {globalSearch
                        ? `${filteredAssets.length} results for "${globalSearch}"`
                        : `All Assets (${allAssets.length})`}
                    </h3>
                  </div>
                  <AssetTable assets={filteredAssets} isLoading={assetsLoading} showCompany />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="companies" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-medium mb-3">Companies ({companies.length})</h3>
                  {companiesLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 text-left">
                            <th className="px-3 py-2 text-xs font-medium">Company</th>
                            <th className="px-3 py-2 text-xs font-medium">ISIN</th>
                            <th className="px-3 py-2 text-xs font-medium">Sector</th>
                            <th className="px-3 py-2 text-xs font-medium text-right">Total Assets (USD)</th>
                            <th className="px-3 py-2 text-xs font-medium text-right">Facilities</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {companies.map((c) => (
                            <tr
                              key={c.id}
                              className="hover-elevate cursor-pointer"
                              onClick={() => {
                                setSelectedCompany(c.name);
                                setActiveTab("company");
                              }}
                              data-testid={`row-company-${c.id}`}
                            >
                              <td className="px-3 py-2 font-medium">{c.name}</td>
                              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{c.isin}</td>
                              <td className="px-3 py-2 text-muted-foreground">{c.sector || "—"}</td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums">
                                {c.totalAssets
                                  ? c.totalAssets >= 1e9
                                    ? `$${(c.totalAssets / 1e9).toFixed(1)}B`
                                    : `$${(c.totalAssets / 1e6).toFixed(0)}M`
                                  : "—"}
                              </td>
                              <td className="px-3 py-2 text-right">{c.assetCount || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>

      <footer className="border-t border-border mt-8">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4">
          <p className="text-xs text-muted-foreground text-center">
            Corporate Asset Database API v2.0 &middot; {stats ? `${stats.totalCompanies} companies` : "Loading..."} &middot; {stats ? `${stats.totalAssets} assets` : ""} &middot; {stats ? `${stats.countriesCount} countries` : ""}
          </p>
        </div>
      </footer>
    </div>
  );
}
