import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ChevronsUpDown, MapPin, Building2 } from "lucide-react";
import { useState, useMemo } from "react";
import type { Asset } from "@shared/schema";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AssetTableProps {
  assets: Asset[];
  isLoading: boolean;
  showCompany?: boolean;
}

type SortField = "facilityName" | "assetType" | "country" | "city" | "valueUsd" | "companyName";
type SortDir = "asc" | "desc";

function formatCurrency(value: number | null): string {
  if (!value) return "—";
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function getCertaintyLabel(certainty: number | null): { text: string; variant: "default" | "secondary" | "outline" } {
  if (!certainty) return { text: "Unknown", variant: "outline" };
  if (certainty >= 8) return { text: "Exact", variant: "default" };
  if (certainty >= 5) return { text: "City", variant: "secondary" };
  return { text: "Approx", variant: "outline" };
}

function getAssetTypeColor(type: string | null): string {
  if (!type) return "bg-muted text-muted-foreground";
  const t = type.toLowerCase();
  if (t.includes("headquarter") || t.includes("head office")) return "bg-chart-1/15 text-chart-1";
  if (t.includes("manufactur") || t.includes("plant") || t.includes("factory")) return "bg-chart-2/15 text-chart-2";
  if (t.includes("distribution") || t.includes("warehouse") || t.includes("logistics")) return "bg-chart-4/15 text-chart-4";
  if (t.includes("data center") || t.includes("server")) return "bg-chart-3/15 text-chart-3";
  if (t.includes("mine") || t.includes("power") || t.includes("refiner")) return "bg-chart-5/15 text-chart-5";
  if (t.includes("retail") || t.includes("store") || t.includes("branch")) return "bg-chart-4/15 text-chart-4";
  return "bg-muted text-muted-foreground";
}

export function AssetTable({ assets, isLoading, showCompany = false }: AssetTableProps) {
  const [sortField, setSortField] = useState<SortField>("valueUsd");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const sorted = useMemo(() => {
    return [...assets].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (aVal == null) aVal = "" as any;
      if (bVal == null) bVal = "" as any;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [assets, sortField, sortDir]);

  const paged = useMemo(() => sorted.slice(page * pageSize, (page + 1) * pageSize), [sorted, page]);
  const totalPages = Math.ceil(sorted.length / pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setPage(0);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Building2 className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">No assets found</p>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {showCompany && (
                <TableHead>
                  <button className="flex items-center gap-1 text-xs font-medium" onClick={() => handleSort("companyName")} data-testid="button-sort-company">
                    Company <SortIcon field="companyName" />
                  </button>
                </TableHead>
              )}
              <TableHead>
                <button className="flex items-center gap-1 text-xs font-medium" onClick={() => handleSort("facilityName")} data-testid="button-sort-facility">
                  Facility <SortIcon field="facilityName" />
                </button>
              </TableHead>
              <TableHead>
                <button className="flex items-center gap-1 text-xs font-medium" onClick={() => handleSort("assetType")} data-testid="button-sort-type">
                  Type <SortIcon field="assetType" />
                </button>
              </TableHead>
              <TableHead>
                <button className="flex items-center gap-1 text-xs font-medium" onClick={() => handleSort("city")} data-testid="button-sort-city">
                  Location <SortIcon field="city" />
                </button>
              </TableHead>
              <TableHead>
                <button className="flex items-center gap-1 text-xs font-medium" onClick={() => handleSort("country")} data-testid="button-sort-country">
                  Country <SortIcon field="country" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button className="flex items-center gap-1 text-xs font-medium ml-auto" onClick={() => handleSort("valueUsd")} data-testid="button-sort-value">
                  Value <SortIcon field="valueUsd" />
                </button>
              </TableHead>
              <TableHead className="text-center">
                <span className="text-xs font-medium">Precision</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((asset) => {
              const certainty = getCertaintyLabel(asset.coordinateCertainty);
              return (
                <TableRow key={asset.id} className="hover-elevate" data-testid={`row-asset-${asset.id}`}>
                  {showCompany && (
                    <TableCell className="font-medium text-sm max-w-[160px] truncate">
                      {asset.companyName}
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium truncate max-w-[220px]" data-testid={`text-facility-${asset.id}`}>
                        {asset.facilityName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${getAssetTypeColor(asset.assetType)}`}>
                      {asset.assetType || "Unknown"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {asset.city || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {asset.country || "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums" data-testid={`text-value-${asset.id}`}>
                    {formatCurrency(asset.valueUsd)}
                  </TableCell>
                  <TableCell className="text-center">
                    {asset.latitude && asset.longitude ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant={certainty.variant} className="text-xs" data-testid={`badge-precision-${asset.id}`}>
                            <MapPin className="w-3 h-3 mr-1" />
                            {certainty.text}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">{asset.latitude?.toFixed(4)}, {asset.longitude?.toFixed(4)}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-xs text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 mt-3">
          <p className="text-xs text-muted-foreground">
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length} assets
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              data-testid="button-prev-page"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              data-testid="button-next-page"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
