import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
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
import { Download, Search, Database, BarChart3, Building2, Table2, Sparkles } from "lucide-react";
import type { Asset, Company } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function Dashboard() {
  const { toast } = useToast();
  const [selectedCompany, setSelectedCompany] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

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
              <Link href="/discover">
                <Button variant="outline" size="sm" data-testid="button-discover">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Discover Companies
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
