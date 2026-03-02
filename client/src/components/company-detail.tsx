import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, DollarSign, Layers, Globe, Navigation, Shield, Database as DatabaseIcon } from "lucide-react";
import type { Asset } from "@shared/schema";
import { useMemo, useEffect, useRef } from "react";
import { AssetTable } from "./asset-table";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

function getAssetColor(type: string | null): string {
  if (!type) return "#6b7280";
  const t = type.toLowerCase();
  if (t.includes("headquarter") || t.includes("head office")) return "#3b82f6";
  if (t.includes("manufactur") || t.includes("plant") || t.includes("factory")) return "#10b981";
  if (t.includes("data center") || t.includes("server")) return "#8b5cf6";
  if (t.includes("office") || t.includes("campus")) return "#f59e0b";
  if (t.includes("research") || t.includes("lab")) return "#ec4899";
  if (t.includes("warehouse") || t.includes("distribution")) return "#6366f1";
  if (t.includes("mine") || t.includes("power") || t.includes("refiner")) return "#ef4444";
  if (t.includes("retail") || t.includes("store")) return "#14b8a6";
  return "#6b7280";
}

function AssetMap({ assets }: { assets: Asset[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const geoAssets = useMemo(() => assets.filter((a) => a.latitude && a.longitude), [assets]);

  useEffect(() => {
    if (!mapRef.current || geoAssets.length === 0) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapRef.current, { scrollWheelZoom: true, zoomControl: true });
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    const markers: L.LatLng[] = [];

    geoAssets.forEach((asset) => {
      const color = getAssetColor(asset.assetType);
      const latLng = L.latLng(asset.latitude!, asset.longitude!);
      markers.push(latLng);

      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="background:${color}; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      const marker = L.marker(latLng, { icon }).addTo(map);

      const popupDiv = document.createElement("div");
      popupDiv.style.fontSize = "12px";
      popupDiv.style.minWidth = "180px";

      const nameEl = document.createElement("strong");
      nameEl.textContent = asset.facilityName;
      popupDiv.appendChild(nameEl);

      popupDiv.appendChild(document.createElement("br"));
      const typeEl = document.createElement("span");
      typeEl.style.color = color;
      typeEl.style.fontWeight = "500";
      typeEl.textContent = asset.assetType || "Unknown";
      popupDiv.appendChild(typeEl);

      popupDiv.appendChild(document.createElement("br"));
      const locText = document.createTextNode(
        `${asset.city ? asset.city + ", " : ""}${asset.country || ""}`
      );
      popupDiv.appendChild(locText);

      popupDiv.appendChild(document.createElement("br"));
      const valueLabel = document.createElement("strong");
      valueLabel.textContent = "Value: ";
      popupDiv.appendChild(valueLabel);
      popupDiv.appendChild(document.createTextNode(formatCurrency(asset.valueUsd || 0)));

      if (asset.ownershipShare != null && asset.ownershipShare < 100) {
        popupDiv.appendChild(document.createElement("br"));
        const ownLabel = document.createElement("strong");
        ownLabel.textContent = "Ownership: ";
        popupDiv.appendChild(ownLabel);
        popupDiv.appendChild(document.createTextNode(`${asset.ownershipShare}%`));
      }

      popupDiv.appendChild(document.createElement("br"));
      const coordLabel = document.createElement("strong");
      coordLabel.textContent = "Coords: ";
      popupDiv.appendChild(coordLabel);
      popupDiv.appendChild(
        document.createTextNode(`${asset.latitude?.toFixed(4)}, ${asset.longitude?.toFixed(4)}`)
      );

      marker.bindPopup(popupDiv);
    });

    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers);
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 6 });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [geoAssets]);

  if (geoAssets.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No geocoded assets to display
      </div>
    );
  }

  return <div ref={mapRef} className="h-full w-full rounded-md" data-testid="map-assets" />;
}

function AssetDetailCard({ asset }: { asset: Asset }) {
  return (
    <Card className="hover-elevate" data-testid={`card-asset-detail-${asset.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold truncate" data-testid={`text-asset-name-${asset.id}`}>{asset.facilityName}</h4>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-xs">{asset.assetType || "Unknown"}</Badge>
              {asset.ownershipShare != null && asset.ownershipShare < 100 && (
                <Badge variant="outline" className="text-xs">{asset.ownershipShare}% owned</Badge>
              )}
            </div>
          </div>
          <p className="text-sm font-mono font-semibold tabular-nums whitespace-nowrap" data-testid={`text-asset-value-${asset.id}`}>
            {formatCurrency(asset.valueUsd || 0)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-xs">
          {asset.address && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Address:</span>{" "}
              <span>{asset.address}</span>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">City:</span>{" "}
            <span>{asset.city || "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Country:</span>{" "}
            <span>{asset.country || "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Latitude:</span>{" "}
            <span className="font-mono">{asset.latitude?.toFixed(4) || "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Longitude:</span>{" "}
            <span className="font-mono">{asset.longitude?.toFixed(4) || "—"}</span>
          </div>
          {asset.coordinateCertainty != null && (
            <div>
              <span className="text-muted-foreground">Coord Certainty:</span>{" "}
              <span>{asset.coordinateCertainty}%</span>
            </div>
          )}
          {asset.valuationConfidence != null && (
            <div>
              <span className="text-muted-foreground">Valuation Confidence:</span>{" "}
              <span>{asset.valuationConfidence}%</span>
            </div>
          )}
          {asset.sizeFactor != null && (
            <div>
              <span className="text-muted-foreground">Size Factor:</span>{" "}
              <span>{asset.sizeFactor}</span>
            </div>
          )}
          {asset.geoFactor != null && (
            <div>
              <span className="text-muted-foreground">Geo Factor:</span>{" "}
              <span>{asset.geoFactor}</span>
            </div>
          )}
          {asset.typeWeight != null && (
            <div>
              <span className="text-muted-foreground">Type Weight:</span>{" "}
              <span>{asset.typeWeight}</span>
            </div>
          )}
          {asset.industryFactor != null && (
            <div>
              <span className="text-muted-foreground">Industry Factor:</span>{" "}
              <span>{asset.industryFactor}</span>
            </div>
          )}
          {asset.ownershipShare != null && (
            <div>
              <span className="text-muted-foreground">Ownership Share:</span>{" "}
              <span>{asset.ownershipShare}%</span>
            </div>
          )}
          {asset.dataSource && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Data Source:</span>{" "}
              <span>{asset.dataSource}</span>
            </div>
          )}
          {asset.sourceDocument && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Source Document:</span>{" "}
              <span>{asset.sourceDocument}</span>
            </div>
          )}
          {asset.sourceUrl && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Source URL:</span>{" "}
              <a href={asset.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline break-all" data-testid={`link-source-url-${asset.id}`}>{asset.sourceUrl}</a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
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
    const avgConfidence = assets.length > 0
      ? Math.round(assets.reduce((sum, a) => sum + (a.valuationConfidence || 0), 0) / assets.length)
      : 0;
    return { totalValue, withCoords, countriesCount: countries.size, types, avgConfidence };
  }, [assets]);

  const summaryCards = [
    { label: "Total Assets", value: assets.length.toString(), icon: Building2 },
    { label: "Total Value", value: formatCurrency(stats.totalValue), icon: DollarSign },
    { label: "Countries", value: stats.countriesCount.toString(), icon: Globe },
    { label: "Geocoded", value: `${stats.withCoords}/${assets.length}`, icon: Navigation },
    { label: "Asset Types", value: stats.types.size.toString(), icon: Layers },
    { label: "Avg Confidence", value: `${stats.avgConfidence}%`, icon: Shield },
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
        {assets[0]?.dataSource && (
          <Badge variant="outline" data-testid="badge-source">
            <DatabaseIcon className="w-3 h-3 mr-1" />
            {assets[0].dataSource}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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

      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-medium mb-3">Asset Locations</h3>
          <div className="h-[360px]">
            <AssetMap assets={assets} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-medium mb-3">Asset Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {assets.map((asset) => (
              <AssetDetailCard key={asset.id} asset={asset} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-medium mb-3">Facilities Table</h3>
          <AssetTable assets={assets} isLoading={false} />
        </CardContent>
      </Card>
    </div>
  );
}
