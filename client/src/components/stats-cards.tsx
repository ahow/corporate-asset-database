import { Card, CardContent } from "@/components/ui/card";
import { Building2, MapPin, DollarSign, Globe2, TrendingUp, BarChart3 } from "lucide-react";

interface StatsData {
  totalCompanies: number;
  totalAssets: number;
  assetsWithCoords: number;
  totalValue: number;
  countriesCount: number;
  avgAssetsPerCompany: number;
}

function formatCurrency(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

export function StatsCards({ stats, isLoading }: { stats: StatsData | null; isLoading: boolean }) {
  const cards = [
    {
      label: "Total Companies",
      value: stats ? formatNumber(stats.totalCompanies) : "—",
      icon: Building2,
      color: "text-chart-1",
      bgColor: "bg-chart-1/10",
    },
    {
      label: "Physical Assets",
      value: stats ? formatNumber(stats.totalAssets) : "—",
      icon: MapPin,
      color: "text-chart-2",
      bgColor: "bg-chart-2/10",
    },
    {
      label: "Portfolio Value",
      value: stats ? formatCurrency(stats.totalValue) : "—",
      icon: DollarSign,
      color: "text-chart-4",
      bgColor: "bg-chart-4/10",
    },
    {
      label: "Countries",
      value: stats ? formatNumber(stats.countriesCount) : "—",
      icon: Globe2,
      color: "text-chart-3",
      bgColor: "bg-chart-3/10",
    },
    {
      label: "Geocoding Coverage",
      value: stats && stats.totalAssets > 0
        ? `${((stats.assetsWithCoords / stats.totalAssets) * 100).toFixed(1)}%`
        : "—",
      icon: TrendingUp,
      color: "text-chart-5",
      bgColor: "bg-chart-5/10",
    },
    {
      label: "Avg Assets / Company",
      value: stats ? stats.avgAssetsPerCompany.toFixed(1) : "—",
      icon: BarChart3,
      color: "text-chart-1",
      bgColor: "bg-chart-1/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-md ${card.bgColor}`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{card.label}</p>
                {isLoading ? (
                  <div className="h-6 w-16 bg-muted animate-pulse rounded-md mt-1" />
                ) : (
                  <p className="text-lg font-semibold tracking-tight truncate" data-testid={`text-stat-${card.label.toLowerCase().replace(/\s+/g, '-')}`}>
                    {card.value}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
