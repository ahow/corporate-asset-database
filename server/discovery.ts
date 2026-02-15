import OpenAI from "openai";
import { storage } from "./storage";
import type { InsertCompany, InsertAsset } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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
}

interface DiscoveredCompany {
  name: string;
  isin: string;
  sector: string;
  assets: DiscoveredAsset[];
}

const DISCOVERY_PROMPT = `You are an expert corporate analyst specializing in physical asset discovery for large corporations. Given a company name, research and identify their major physical assets (headquarters, offices, manufacturing plants, data centers, warehouses, retail locations, research facilities, refineries, power plants, etc.).

For each company, provide:
1. The company's ISIN code (International Securities Identification Number - 12 characters). If you don't know the exact ISIN, provide your best estimate using the standard format (country code + 9 alphanumeric + check digit).
2. The company's sector (e.g., Technology, Energy, Industrials, Healthcare, Consumer Staples, Financials, etc.)
3. A list of 4-8 major physical assets/facilities

For each asset, provide:
- facility_name: A descriptive name for the facility
- address: Street address or location description
- city: City name
- country: Country name
- latitude: Approximate latitude coordinate
- longitude: Approximate longitude coordinate
- coordinate_certainty: 1-100 confidence in coordinates (80+ for well-known locations)
- asset_type: One of: Headquarters, Office, Manufacturing Plant, Data Center, Warehouse, Distribution Center, Retail Store, Research Facility, Refinery, Power Plant, Laboratory, Campus
- value_usd: Estimated value in USD (consider real estate value, equipment, strategic importance)
- size_factor: 0.1-1.0 relative size factor
- geo_factor: 0.5-1.5 geographic value factor (higher for prime locations)
- type_weight: 0.5-1.5 asset type importance weight
- industry_factor: 0.5-1.5 industry-specific multiplier
- valuation_confidence: 1-100 confidence in valuation estimate

Respond with valid JSON only. The response must be a JSON object with the following structure:
{
  "name": "Full Official Company Name",
  "isin": "XX0000000000",
  "sector": "Sector Name",
  "assets": [...]
}`;

export async function discoverCompany(companyName: string): Promise<DiscoveredCompany> {
  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: DISCOVERY_PROMPT },
      { role: "user", content: `Discover and analyze the physical assets of: ${companyName}` },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 8192,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error(`No response from AI for company: ${companyName}`);
  }

  const parsed = JSON.parse(content) as DiscoveredCompany;
  if (!parsed.name || !parsed.isin || !parsed.assets || !Array.isArray(parsed.assets)) {
    throw new Error(`Invalid response structure for company: ${companyName}`);
  }

  return parsed;
}

export async function saveDiscoveredCompany(discovered: DiscoveredCompany): Promise<{ company: any; assetCount: number }> {
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
    sector: discovered.sector,
    dataSource: "AI Discovery (GPT)",
  }));

  await storage.bulkCreateAssets(assetInserts);

  return { company, assetCount: assetInserts.length };
}
