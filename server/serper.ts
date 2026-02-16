interface SerperResult {
  title: string;
  link: string;
  snippet: string;
}

interface SerperResponse {
  organic?: SerperResult[];
  knowledgeGraph?: {
    title?: string;
    description?: string;
    attributes?: Record<string, string>;
  };
}

async function serperSearch(query: string, num: number = 5): Promise<SerperResponse> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error("SERPER_API_KEY not configured");

  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num, gl: "us", hl: "en" }),
  });

  if (!response.ok) {
    throw new Error(`Serper API error (${response.status})`);
  }

  return response.json();
}

function extractSnippets(results: SerperResponse): string[] {
  const snippets: string[] = [];

  if (results.knowledgeGraph) {
    const kg = results.knowledgeGraph;
    if (kg.description) snippets.push(kg.description);
    if (kg.attributes) {
      for (const [key, value] of Object.entries(kg.attributes)) {
        snippets.push(`${key}: ${value}`);
      }
    }
  }

  if (results.organic) {
    for (const r of results.organic) {
      if (r.snippet) snippets.push(`${r.snippet} [Source: ${r.title}]`);
    }
  }

  return snippets;
}

const SECTOR_QUERIES: Record<string, string[]> = {
  mining: [
    "mines operations mining sites locations worldwide complete list",
    "smelters refineries processing plants concentrators pellet plants",
    "joint ventures minority stakes mining partnerships ownership percentage",
    "port terminals rail networks shipping infrastructure logistics",
    "power plants energy generation solar wind hydroelectric facilities",
    "exploration projects development pipeline new mines under construction",
  ],
  energy: [
    "refineries oil gas operations platforms fields worldwide list",
    "LNG terminals pipelines processing plants gas facilities",
    "offshore drilling rigs production facilities deepwater",
    "petrochemical plants chemical facilities downstream operations",
    "renewable energy solar wind power generation assets",
    "tank farms storage terminals fuel depots logistics",
  ],
  utilities: [
    "power plants generating stations nuclear solar wind complete list",
    "transmission substations grid infrastructure facilities",
    "renewable energy farms solar wind hydro facilities worldwide",
    "natural gas plants LNG storage distribution facilities",
    "water treatment desalination plants infrastructure",
  ],
  technology: [
    "data centers campus offices worldwide locations complete list",
    "research labs R&D facilities engineering centers",
    "cloud infrastructure server farms colocation facilities",
    "manufacturing plants chip fabrication semiconductor foundries",
    "distribution warehouses fulfillment centers logistics",
  ],
  industrials: [
    "manufacturing plants factories production facilities worldwide complete list",
    "warehouses distribution centers logistics hubs supply chain",
    "shipyards rail yards assembly plants fabrication shops",
    "research development centers testing facilities laboratories",
    "service centers maintenance repair overhaul facilities",
  ],
  healthcare: [
    "manufacturing plants pharmaceutical production facilities worldwide",
    "research centers laboratories R&D campuses clinical trials",
    "distribution centers warehouses global operations logistics",
    "office headquarters regional offices worldwide locations",
    "biotechnology facilities vaccine production sites",
  ],
  consumer: [
    "manufacturing plants factories production sites worldwide complete list",
    "distribution centers warehouses logistics network supply chain",
    "research innovation centers R&D facilities labs",
    "bottling plants brewing facilities food processing sites",
    "regional offices headquarters locations worldwide",
  ],
  financial: [
    "offices headquarters towers regional centers worldwide",
    "data centers technology infrastructure facilities",
    "operations centers trading floors campuses locations",
    "branches offices worldwide locations real estate",
  ],
};

function getSectorQueries(companyName: string): string[] {
  const name = companyName.toLowerCase();
  if (name.match(/mining|bhp|rio tinto|vale|glencore|freeport|barrick|newmont|anglo american|fortescue|teck|south32|antofagasta/)) {
    return SECTOR_QUERIES.mining;
  }
  if (name.match(/energy|exxon|chevron|shell|bp\b|total|conoco|petro|oil|gas|aramco|eni\b|equinor|woodside|santos/)) {
    return SECTOR_QUERIES.energy;
  }
  if (name.match(/electric|power|utility|nextera|duke|southern|dominion|enel|engie|iberdrola/)) {
    return SECTOR_QUERIES.utilities;
  }
  if (name.match(/tech|apple|microsoft|google|alphabet|meta|amazon|nvidia|intel|ibm|oracle|cisco|samsung|tsmc/)) {
    return SECTOR_QUERIES.technology;
  }
  if (name.match(/pharma|pfizer|johnson|merck|roche|novartis|abbvie|lilly|astrazeneca|sanofi|bayer|gsk|gilead/)) {
    return SECTOR_QUERIES.healthcare;
  }
  if (name.match(/industrial|caterpillar|deere|honeywell|3m|siemens|ge\b|boeing|lockheed|raytheon|thyssenkrupp/)) {
    return SECTOR_QUERIES.industrials;
  }
  if (name.match(/bank|capital|financial|jpmorgan|goldman|morgan stanley|citi|wells fargo|hsbc|barclays|ubs/)) {
    return SECTOR_QUERIES.financial;
  }
  if (name.match(/procter|unilever|nestle|coca|pepsi|colgate|kraft|mondelez|consumer|diageo|anheuser/)) {
    return SECTOR_QUERIES.consumer;
  }
  return [];
}

export async function searchCompanyAssets(companyName: string, isin?: string): Promise<string> {
  const baseSearches = [
    `"${companyName}" major facilities headquarters offices locations worldwide`,
    `"${companyName}" manufacturing plants factories production sites global operations`,
    `"${companyName}" annual report property plant equipment PP&E total assets`,
    `"${companyName}" operations locations subsidiaries facilities complete list`,
    `"${companyName}" joint ventures partnerships ownership stakes percentage`,
  ];

  if (isin) {
    baseSearches.push(`${isin} ${companyName} SEC filing 10-K property assets facilities`);
  }

  const sectorQueries = getSectorQueries(companyName);
  for (const sq of sectorQueries) {
    baseSearches.push(`"${companyName}" ${sq}`);
  }

  const allSnippets: string[] = [];

  for (const query of baseSearches) {
    try {
      const results = await serperSearch(query, 6);
      const snippets = extractSnippets(results);
      allSnippets.push(...snippets);
    } catch {
      continue;
    }
  }

  if (allSnippets.length === 0) return "";

  const unique = Array.from(new Set(allSnippets));
  const trimmed = unique.slice(0, 60);

  return trimmed.join("\n\n");
}

export function isSerperAvailable(): boolean {
  return !!process.env.SERPER_API_KEY;
}
