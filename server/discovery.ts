import { storage } from "./storage";
import type { InsertCompany, InsertAsset } from "@shared/schema";
import { callLLM, type LLMResponse } from "./llm-providers";
import { searchCompanyAssets, isSerperAvailable } from "./serper";

interface DiscoveredAsset {
  facility_name: string;
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  coordinate_certainty: number;
  asset_type: string;
  value_usd: number;
  size_factor: number;
  geo_factor: number;
  type_weight: number;
  industry_factor: number;
  valuation_confidence: number;
  ownership_share: number;
}

interface DiscoveredCompany {
  name: string;
  isin: string;
  sector: string;
  assets: DiscoveredAsset[];
}

export interface DiscoveryResult {
  company: DiscoveredCompany;
  llmResponse: LLMResponse;
}

export interface MultiPassDiscoveryResult {
  company: DiscoveredCompany;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  passCount: number;
  webResearchUsed: boolean;
}

const ASSET_FIELDS_DESCRIPTION = `For each asset, provide:
- facility_name: A descriptive name for the facility
- address: Street address or location description
- city: City name
- country: Country name
- latitude: Approximate latitude coordinate
- longitude: Approximate longitude coordinate
- coordinate_certainty: 1-100 confidence in coordinates (80+ for well-known locations)
- asset_type: One of: Headquarters, Office, Mine, Smelter, Refinery, Processing Plant, Manufacturing Plant, Data Center, Warehouse, Distribution Center, Port Terminal, Rail Yard, Pipeline, Power Plant, Solar Farm, Wind Farm, Research Facility, Laboratory, Campus, Retail Store, Hotel, Theme Park, Shipyard, Drilling Platform, LNG Terminal, or other descriptive type
- value_usd: Estimated value in USD (consider real estate value, equipment, strategic importance)
- size_factor: 0.1-1.0 relative size factor
- geo_factor: 0.5-1.5 geographic value factor (higher for prime locations)
- type_weight: 0.5-1.5 asset type importance weight
- industry_factor: 0.5-1.5 industry-specific multiplier
- valuation_confidence: 1-100 confidence in valuation estimate
- ownership_share: Percentage of the asset owned by the company (0-100). Use 100 for wholly-owned assets. For joint ventures, partnerships, or partial ownership, use the company's actual ownership percentage. The value_usd should reflect the TOTAL asset value (not the company's share — the ownership_share field captures the percentage).`;

const DISCOVERY_PROMPT = `You are an expert corporate analyst specializing in comprehensive physical asset discovery for global corporations. Given a company name, research and identify ALL significant physical assets they own or operate worldwide. Be as thorough and complete as possible — do not limit yourself to a small number. Include every major facility you know about.

For each company, provide:
1. The company's ISIN code (International Securities Identification Number - 12 characters). If you don't know the exact ISIN, provide your best estimate using the standard format (country code + 9 alphanumeric + check digit).
2. The company's sector (e.g., Technology, Energy, Industrials, Healthcare, Consumer Staples, Financials, Materials, Utilities, etc.)
3. A comprehensive list of ALL significant physical assets/facilities. Systematically go through EVERY category below and list all known sites for each:
   - Corporate: Headquarters, major regional/country offices
   - Extraction: Mines (open pit, underground), quarries, wells, drilling platforms
   - Processing: Smelters, refineries, processing plants, concentrators, pellet plants
   - Manufacturing: Factories, assembly plants, fabrication facilities
   - Infrastructure: Port terminals, rail yards, rail networks, pipelines, conveyor systems
   - Energy: Power plants, solar farms, wind farms, hydroelectric dams, LNG terminals
   - Logistics: Warehouses, distribution centers, storage facilities, tank farms
   - R&D: Research facilities, laboratories, technology centers, innovation hubs
   - Other: Campuses, shipyards, retail stores, hotels, theme parks, hospitals

Think through the company's COMPLETE global footprint. Consider all countries where they operate. Consider joint ventures and partially-owned assets. Aim for 30+ assets for major global corporations.

${ASSET_FIELDS_DESCRIPTION}

Respond with valid JSON only. The response must be a JSON object with the following structure:
{
  "name": "Full Official Company Name",
  "isin": "XX0000000000",
  "sector": "Sector Name",
  "assets": [...]
}`;

const SUPPLEMENTARY_PROMPT = `You are an expert corporate analyst reviewing an initial asset discovery for completeness. Your job is to identify MISSING assets that were not found in the first pass.

You will receive:
1. A company name with its sector
2. A list of assets already identified
3. Web research data (if available)

Your task: Identify ADDITIONAL assets that are MISSING from the list. Think systematically through every category:
- Are all major mines/extraction sites listed? (Consider all countries of operation)
- Are all smelters, refineries, and processing plants included?
- Are key port terminals and rail infrastructure captured?
- Are power generation assets (power plants, solar/wind farms, hydro dams) included?
- Are all major regional offices in key markets listed?
- Are joint ventures and partially-owned major assets included?
- Are research centers, labs, and technology hubs captured?
- Are warehouses, distribution centers, and logistics facilities included?
- Are there any recently acquired or under-construction facilities?

Only return NEW assets not already in the provided list. Do not duplicate any assets. If you believe the list is already comprehensive, return an empty assets array.

${ASSET_FIELDS_DESCRIPTION}

Respond with valid JSON only:
{
  "additional_assets": [...]
}`;

export async function discoverCompany(companyName: string, providerId: string = "openai", isin?: string): Promise<MultiPassDiscoveryResult> {
  let webContext = "";
  let webResearchUsed = false;

  if (isSerperAvailable()) {
    try {
      webContext = await searchCompanyAssets(companyName, isin);
      if (webContext.length > 0) {
        webResearchUsed = true;
      }
    } catch {
      webContext = "";
    }
  }

  let userPrompt = `Discover and analyze the physical assets of: ${companyName}`;
  if (isin) {
    userPrompt += `\n\nIMPORTANT: This company has the ISIN code ${isin}. Use this ISIN to ensure you are researching the correct company. The ISIN must match exactly in your response.`;
  }

  if (webContext) {
    userPrompt += `\n\n--- WEB RESEARCH DATA ---\nThe following information was gathered from recent web searches about this company's physical assets, facilities, and financial filings. Use this data to improve accuracy of facility names, locations, coordinates, and valuations. Cross-reference with your knowledge and prioritize factual data from these sources:\n\n${webContext}\n--- END WEB RESEARCH DATA ---`;
  }

  const pass1Response = await callLLM(providerId, DISCOVERY_PROMPT, userPrompt);

  const content = pass1Response.content;
  if (!content) {
    throw new Error(`No response from AI for company: ${companyName}`);
  }

  const parsed = JSON.parse(content) as DiscoveredCompany;
  if (!parsed.name || !parsed.isin || !parsed.assets || !Array.isArray(parsed.assets)) {
    throw new Error(`Invalid response structure for company: ${companyName}`);
  }

  let totalInputTokens = pass1Response.inputTokens;
  let totalOutputTokens = pass1Response.outputTokens;
  let totalCostUsd = pass1Response.costUsd;
  let passCount = 1;

  const pass2UserPrompt = buildSupplementaryPrompt(parsed, webContext);

  try {
    const pass2Response = await callLLM(providerId, SUPPLEMENTARY_PROMPT, pass2UserPrompt);
    passCount = 2;
    totalInputTokens += pass2Response.inputTokens;
    totalOutputTokens += pass2Response.outputTokens;
    totalCostUsd += pass2Response.costUsd;

    if (pass2Response.content) {
      const supplementary = JSON.parse(pass2Response.content);
      const additionalAssets: DiscoveredAsset[] = supplementary.additional_assets || supplementary.assets || [];

      if (additionalAssets.length > 0) {
        const existingNames = new Set(parsed.assets.map(a => a.facility_name.toLowerCase().trim()));
        const existingLocations = new Set(parsed.assets.map(a => `${a.city?.toLowerCase().trim()}-${a.asset_type?.toLowerCase().trim()}`));

        for (const newAsset of additionalAssets) {
          const nameLower = newAsset.facility_name?.toLowerCase().trim();
          const locationKey = `${newAsset.city?.toLowerCase().trim()}-${newAsset.asset_type?.toLowerCase().trim()}`;

          if (nameLower && !existingNames.has(nameLower) && !existingLocations.has(locationKey)) {
            parsed.assets.push(newAsset);
            existingNames.add(nameLower);
            existingLocations.add(locationKey);
          }
        }
      }
    }
  } catch (err) {
    console.warn(`Supplementary pass failed for ${companyName}, using pass 1 results only:`, err instanceof Error ? err.message : err);
  }

  return {
    company: parsed,
    totalInputTokens,
    totalOutputTokens,
    totalCostUsd,
    passCount,
    webResearchUsed,
  };
}

function buildSupplementaryPrompt(company: DiscoveredCompany, webContext: string): string {
  const assetSummary = company.assets.map((a, i) =>
    `${i + 1}. ${a.facility_name} (${a.asset_type}) - ${a.city}, ${a.country} [${a.ownership_share ?? 100}% owned]`
  ).join("\n");

  const assetTypeCount: Record<string, number> = {};
  for (const a of company.assets) {
    const t = a.asset_type || "Unknown";
    assetTypeCount[t] = (assetTypeCount[t] || 0) + 1;
  }
  const typeSummary = Object.entries(assetTypeCount)
    .map(([type, count]) => `${type}: ${count}`)
    .join(", ");

  let prompt = `Company: ${company.name}
Sector: ${company.sector}
ISIN: ${company.isin}

ASSETS ALREADY IDENTIFIED (${company.assets.length} total):
Types breakdown: ${typeSummary}

${assetSummary}

Review this list carefully. Identify significant physical assets that are MISSING. Consider:
- All countries where ${company.name} operates
- Joint ventures and partnerships (with correct ownership percentages)
- Recently acquired facilities
- Infrastructure assets (ports, railways, pipelines, conveyor systems)
- Energy generation assets (power plants, renewable energy)
- Storage and logistics facilities
- R&D and technology centers in key markets
- Processing and refining facilities that may have been overlooked`;

  if (webContext) {
    prompt += `\n\n--- WEB RESEARCH DATA ---\nUse the following web research to identify any assets mentioned but not yet captured in the list above:\n\n${webContext}\n--- END WEB RESEARCH DATA ---`;
  }

  return prompt;
}

export function normalizeAssetValues(discovered: DiscoveredCompany, totalValue?: number): boolean {
  if (!totalValue || totalValue <= 0 || !discovered.assets || discovered.assets.length === 0) {
    return false;
  }

  const aiTotal = discovered.assets.reduce((sum, a) => sum + (a.value_usd || 0), 0);
  if (aiTotal <= 0) return false;

  const scaleFactor = totalValue / aiTotal;

  for (const asset of discovered.assets) {
    asset.value_usd = Math.round((asset.value_usd || 0) * scaleFactor);
  }

  return true;
}

export async function saveDiscoveredCompany(discovered: DiscoveredCompany, providerId: string): Promise<{ company: any; assetCount: number }> {
  const totalValue = discovered.assets.reduce((sum, a) => sum + (a.value_usd || 0), 0);

  const companyData: InsertCompany = {
    isin: discovered.isin,
    name: discovered.name,
    sector: discovered.sector,
    totalAssets: totalValue,
    assetCount: discovered.assets.length,
  };

  const company = await storage.upsertCompany(companyData);

  await storage.deleteAssetsByCompany(discovered.name);

  const providerLabel = providerId === "openai" ? "GPT" :
    providerId === "deepseek" ? "DeepSeek" :
    providerId === "gemini" ? "Gemini" :
    providerId === "claude" ? "Claude" :
    providerId === "minimax" ? "MiniMax" : providerId;

  const assetInserts: InsertAsset[] = discovered.assets.map((a) => ({
    companyName: discovered.name,
    isin: discovered.isin,
    facilityName: a.facility_name,
    address: a.address,
    city: a.city,
    country: a.country,
    latitude: a.latitude,
    longitude: a.longitude,
    coordinateCertainty: a.coordinate_certainty,
    assetType: a.asset_type,
    valueUsd: a.value_usd,
    sizeFactor: a.size_factor,
    geoFactor: a.geo_factor,
    typeWeight: a.type_weight,
    industryFactor: a.industry_factor,
    valuationConfidence: a.valuation_confidence,
    ownershipShare: a.ownership_share ?? 100,
    sector: discovered.sector,
    dataSource: `AI Discovery (${providerLabel})`,
  }));

  await storage.bulkCreateAssets(assetInserts);

  return { company, assetCount: assetInserts.length };
}
