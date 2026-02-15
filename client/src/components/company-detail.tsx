import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, DollarSign, Layers } from "lucide-react";
import type { Asset } from "@shared/schema";
import { useMemo } from "react";
import { AssetTable } from "./asset-table";
import { AssetTypeChart } from "./sector-chart";

interface CompanyDetailProps {
  companyName: string;
  assets: Asset[];
}

function formatCurrency(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

export function CompanyDetail({ companyName, assets }: CompanyDetailProps) {
  const stats = useMemo(() => {
    const totalValue = assets.reduce((sum, a) => sum + (a.valueUsd || 0), 0);
    const withCoords = assets.filter((a) => a.latitude && a.longitude).length;
    const countries = new Set(assets.map((a) => a.country).filter(Boolean));
    const types = new Map<string, number>();
    assets.forEach((a) => {
      const t = a.assetType || "Other";
      types.set(t, (types.get(t) || 0) + 1);
    });
    return { totalValue, withCoords, countriesCount: countries.size, types };
  }, [assets]);

  const summaryCards = [
    { label: "Total Assets", value: assets.length.toString(), icon: Building2 },
    { label: "Total Value", value: formatCurrency(stats.totalValue), icon: DollarSign },
    { label: "Countries", value: stats.countriesCount.toString(), icon: MapPin },
    { label: "Asset Types", value: stats.types.size.toString(), icon: Layers },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-semibold" data-testid="text-company-name">{companyName}</h2>
        {assets[0]?.isin && (
          <Badge variant="secondary" data-testid="badge-isin">{assets[0].isin}</Badge>
        )}
        {assets[0]?.sector && (
          <Badge variant="outline" data-testid="badge-sector">{assets[0].sector}</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <card.icon className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className="text-lg font-semibold">{card.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-medium mb-3">Facilities</h3>
              <AssetTable assets={assets} isLoading={false} />
            </CardContent>
          </Card>
        </div>
        <div>
          <AssetTypeChart assets={assets} />
        </div>
      </div>
    </div>
  );
}
