import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CompanySelectorProps {
  companies: { isin: string; name: string; sector: string | null }[];
  selectedCompany: string;
  onSelect: (company: string) => void;
  isLoading: boolean;
}

export function CompanySelector({ companies, selectedCompany, onSelect, isLoading }: CompanySelectorProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return companies;
    const lower = search.toLowerCase();
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        c.isin.toLowerCase().includes(lower) ||
        (c.sector && c.sector.toLowerCase().includes(lower))
    );
  }, [companies, search]);

  const sectors = useMemo(() => {
    const sectorMap = new Map<string, { isin: string; name: string; sector: string | null }[]>();
    filtered.forEach((c) => {
      const s = c.sector || "Other";
      if (!sectorMap.has(s)) sectorMap.set(s, []);
      sectorMap.get(s)!.push(c);
    });
    return Array.from(sectorMap.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  if (isLoading) {
    return <div className="h-9 w-64 bg-muted animate-pulse rounded-md" />;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={selectedCompany} onValueChange={onSelect}>
        <SelectTrigger className="w-72" data-testid="select-company">
          <SelectValue placeholder="Select a company..." />
        </SelectTrigger>
        <SelectContent>
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search companies..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-company-search"
              />
            </div>
          </div>
          {sectors.map(([sector, sectorCompanies]) => (
            <div key={sector}>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{sector}</div>
              {sectorCompanies.map((c) => (
                <SelectItem key={c.isin} value={c.name} data-testid={`select-item-${c.isin}`}>
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{c.isin}</span>
                </SelectItem>
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">No companies found</div>
          )}
        </SelectContent>
      </Select>
      {selectedCompany && (
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onSelect("")}
          data-testid="button-clear-company"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
