import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Database, ArrowLeft, Brain, MapPin, Calculator, Layers, Shield, Globe, Search } from "lucide-react";
import { Link } from "wouter";

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Icon className="w-4 h-4 text-chart-1" />
          <h3 className="text-base font-semibold">{title}</h3>
        </div>
        <div className="text-sm text-muted-foreground space-y-2">{children}</div>
      </CardContent>
    </Card>
  );
}

export default function Methodology() {
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
              <Link href="/">
                <Button variant="outline" size="sm" data-testid="button-back-dashboard">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                  Dashboard
                </Button>
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[900px] mx-auto px-4 sm:px-6 py-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-1" data-testid="text-methodology-title">Methodology</h2>
          <p className="text-sm text-muted-foreground">
            How we discover, geolocate, and value corporate physical assets
          </p>
        </div>

        <Section icon={Search} title="Data Discovery">
          <p>
            The Corporate Asset Database uses two primary approaches to identify and catalog physical assets owned by global corporations:
          </p>
          <div className="mt-2 space-y-2">
            <div>
              <span className="font-medium text-foreground">Manual Research (Seed Data)</span>
              <p>
                Initial seed data is compiled from publicly available SEC filings (10-K annual reports), corporate sustainability reports, investor presentations, and press releases. Each company's major facilities are identified including headquarters, manufacturing plants, data centers, research centers, warehouses, and retail locations.
              </p>
            </div>
            <div>
              <span className="font-medium text-foreground">AI-Powered Discovery</span>
              <p>
                The system supports automated asset discovery using multiple large language models (LLMs). Users can choose from five AI providers (OpenAI, DeepSeek, Google Gemini, Claude, or MiniMax) to research a company and identify its major physical assets. The AI analyzes public information about each company and returns structured data about its facilities, including locations, types, and estimated values.
              </p>
            </div>
            <div>
              <span className="font-medium text-foreground">Web-Enhanced Research (Serper API)</span>
              <p>
                When the Serper API key is configured, the system performs 3-4 targeted Google searches per company before consulting the AI model. These searches cover facility locations, manufacturing plants, SEC filings, and property/plant/equipment data. The search results are fed as grounding context to the LLM, significantly improving the accuracy of facility names, addresses, coordinates, and valuations. This is optional and the system gracefully falls back to pure LLM knowledge when unavailable.
              </p>
            </div>
          </div>
        </Section>

        <Section icon={Brain} title="AI Model Comparison">
          <p>
            The system supports five AI providers, allowing users to compare results and costs across different models:
          </p>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { name: "OpenAI (GPT-5 Mini)", desc: "Strong general knowledge, structured JSON support" },
              { name: "DeepSeek (V3)", desc: "Cost-effective, good reasoning capabilities" },
              { name: "Google Gemini (2.0 Flash)", desc: "Fast inference, competitive pricing" },
              { name: "Claude (Sonnet 4)", desc: "High accuracy, detailed analysis" },
              { name: "MiniMax (M2.5)", desc: "Balanced performance and cost" },
            ].map((m) => (
              <div key={m.name} className="p-2 rounded-md border border-border">
                <span className="font-medium text-foreground text-xs">{m.name}</span>
                <p className="text-xs">{m.desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-2">
            Each discovery job tracks the number of input/output tokens used and the total cost, enabling direct cost-effectiveness comparisons between providers.
          </p>
        </Section>

        <Section icon={MapPin} title="Geolocation">
          <p>
            Every asset in the database includes latitude and longitude coordinates. Coordinates are sourced through:
          </p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Known street addresses mapped to precise coordinates (certainty 90-100%)</li>
            <li>City-level geolocation for facilities where exact addresses are not publicly available (certainty 60-80%)</li>
            <li>AI-estimated coordinates based on publicly known facility locations (certainty 50-85%)</li>
          </ul>
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            <span>Each asset has a</span>
            <Badge variant="outline" className="text-xs no-default-active-elevate">Coordinate Certainty</Badge>
            <span>score (1-100) indicating confidence in the geographic placement.</span>
          </div>
        </Section>

        <Section icon={Calculator} title="Valuation Methodology">
          <p>
            Asset valuations are estimates based on a multi-factor model. The estimated value for each asset considers:
          </p>
          <div className="mt-2 space-y-1.5">
            {[
              { factor: "Size Factor", range: "0.1 - 1.0", desc: "Relative size of the facility (square footage, capacity, number of employees)" },
              { factor: "Geographic Factor", range: "0.5 - 1.5", desc: "Real estate value multiplier based on location (prime city centers score higher)" },
              { factor: "Type Weight", range: "0.5 - 1.5", desc: "Value weighting by asset type (e.g., data centers and HQs tend to be higher value)" },
              { factor: "Industry Factor", range: "0.5 - 1.5", desc: "Industry-specific multiplier reflecting sector norms for physical asset intensity" },
            ].map((f) => (
              <div key={f.factor} className="p-2 rounded-md border border-border">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground text-xs">{f.factor}</span>
                  <Badge variant="secondary" className="text-xs">{f.range}</Badge>
                </div>
                <p className="text-xs mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            <span>Each asset also has a</span>
            <Badge variant="outline" className="text-xs no-default-active-elevate">Valuation Confidence</Badge>
            <span>score (1-100) reflecting the reliability of the estimate. Publicly disclosed values (from 10-K filings) receive higher confidence scores than AI-estimated values.</span>
          </div>
        </Section>

        <Section icon={Layers} title="Ownership Share">
          <p>
            The database tracks each company's ownership share of an asset. This is important because:
          </p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Many large facilities are joint ventures or partnerships between multiple companies</li>
            <li>Companies may own only a percentage of a manufacturing plant, refinery, or office complex</li>
            <li>The <strong className="text-foreground">value_usd</strong> field reflects only the company's proportional share of the asset</li>
          </ul>
          <p className="mt-2">
            For example, if a $1 billion refinery is 50% owned by Company A and 50% by Company B, Company A's record shows a value of $500 million with an ownership share of 50%. Wholly-owned assets have an ownership share of 100%.
          </p>
        </Section>

        <Section icon={Globe} title="Data Sources">
          <div className="flex items-center gap-1 flex-wrap">
            <span>Each asset record includes a</span>
            <Badge variant="outline" className="text-xs no-default-active-elevate">Data Source</Badge>
            <span>field indicating where the information originated:</span>
          </div>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li><strong className="text-foreground">10-K filings</strong> (e.g., "Apple 2024 10-K") - Highest reliability, sourced from annual SEC filings</li>
            <li><strong className="text-foreground">AI Discovery</strong> (e.g., "AI Discovery (GPT)") - AI-generated data with the model provider noted in parentheses</li>
            <li><strong className="text-foreground">Corporate reports</strong> - Sustainability reports, investor presentations, press releases</li>
          </ul>
        </Section>

        <Section icon={Shield} title="Limitations & Disclaimers">
          <p className="text-foreground font-medium">Important: This data is for informational and research purposes only.</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Asset valuations are estimates and may not reflect actual market values, book values, or replacement costs</li>
            <li>AI-discovered assets may contain inaccuracies in location, type, or valuation</li>
            <li>Coordinate certainty varies; some locations are approximate to the city level</li>
            <li>Ownership structures may change due to acquisitions, divestitures, or restructuring</li>
            <li>Historical data may not reflect current conditions (closures, expansions, or relocations)</li>
            <li>This database does not constitute financial advice and should not be used as the sole basis for investment decisions</li>
          </ul>
        </Section>
      </main>

      <footer className="border-t border-border mt-8">
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-4">
          <p className="text-xs text-muted-foreground text-center">
            Corporate Asset Database API v2.0 &middot; Methodology Documentation
          </p>
        </div>
      </footer>
    </div>
  );
}
