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
    "mines operations mining sites locations worldwide",
    "smelters refineries processing plants ports",
    "joint ventures minority stakes mining partnerships",
  ],
  energy: [
    "refineries oil gas operations platforms fields",
    "LNG terminals pipelines processing plants",
    "offshore drilling rigs production facilities",
  ],
  utilities: [
    "power plants generating stations nuclear solar wind",
    "transmission substations grid infrastructure",
    "renewable energy farms solar wind hydro facilities",
  ],
  technology: [
    "data centers campus offices worldwide locations",
    "research labs R&D facilities engineering centers",
    "cloud infrastructure server farms colocation",
  ],
  industrials: [
    "manufacturing plants factories production facilities worldwide",
    "warehouses distribution centers logistics hubs",
    "shipyards rail yards assembly plants",
  ],
  healthcare: [
    "manufacturing plants pharmaceutical production facilities",
    "research centers laboratories R&D campuses",
    "distribution centers warehouses global operations",
  ],
  consumer: [
    "manufacturing plants factories production sites worldwide",
    "distribution centers warehouses logistics network",
    "research innovation centers R&D facilities",
  ],
  financial: [
    "offices headquarters towers regional centers",
    "data centers technology infrastructure",
    "operations centers trading floors campuses",
  ],
};

function getSectorQueries(companyName: string): string[] {
  const name = companyName.toLowerCase();
  if (name.match(/mining|bhp|rio tinto|vale|glencore|freeport|barrick|newmont|anglo american|fortescue/)) {
    return SECTOR_QUERIES.mining;
  }
  if (name.match(/energy|exxon|chevron|shell|bp\b|total|conoco|petro|oil|gas|aramco|eni\b/)) {
    return SECTOR_QUERIES.energy;
  }
  if (name.match(/electric|power|utility|nextera|duke|southern|dominion|enel/)) {
    return SECTOR_QUERIES.utilities;
  }
  if (name.match(/tech|apple|microsoft|google|alphabet|meta|amazon|nvidia|intel|ibm|oracle|cisco|samsung/)) {
    return SECTOR_QUERIES.technology;
  }
  if (name.match(/pharma|pfizer|johnson|merck|roche|novartis|abbvie|lilly|astrazeneca|sanofi|bayer/)) {
    return SECTOR_QUERIES.healthcare;
  }
  if (name.match(/industrial|caterpillar|deere|honeywell|3m|siemens|ge\b|boeing|lockheed|raytheon/)) {
    return SECTOR_QUERIES.industrials;
  }
  if (name.match(/bank|capital|financial|jpmorgan|goldman|morgan stanley|citi|wells fargo|hsbc|barclays/)) {
    return SECTOR_QUERIES.financial;
  }
  if (name.match(/procter|unilever|nestle|coca|pepsi|colgate|kraft|mondelez|consumer/)) {
    return SECTOR_QUERIES.consumer;
  }
  return [];
}

export async function searchCompanyAssets(companyName: string, isin?: string): Promise<string> {
  const baseSearches = [
    `"${companyName}" major facilities headquarters offices locations worldwide`,
    `"${companyName}" manufacturing plants factories production sites global operations`,
    `"${companyName}" annual report property plant equipment PP&E total assets`,
    `"${companyName}" operations locations subsidiaries facilities list`,
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
      const results = await serperSearch(query, 5);
      const snippets = extractSnippets(results);
      allSnippets.push(...snippets);
    } catch {
      continue;
    }
  }

  if (allSnippets.length === 0) return "";

  const unique = Array.from(new Set(allSnippets));
  const trimmed = unique.slice(0, 40);

  return trimmed.join("\n\n");
}

export function isSerperAvailable(): boolean {
  return !!process.env.SERPER_API_KEY;
}
