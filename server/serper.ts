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

export async function searchCompanyAssets(companyName: string, isin?: string): Promise<string> {
  const searches = [
    `"${companyName}" major facilities offices headquarters locations`,
    `"${companyName}" manufacturing plants data centers warehouses real estate`,
    `"${companyName}" annual report property plant equipment PP&E assets`,
  ];

  if (isin) {
    searches.push(`${isin} ${companyName} SEC filing 10-K property assets`);
  }

  const allSnippets: string[] = [];

  for (const query of searches) {
    try {
      const results = await serperSearch(query, 4);
      const snippets = extractSnippets(results);
      allSnippets.push(...snippets);
    } catch {
      continue;
    }
  }

  if (allSnippets.length === 0) return "";

  const unique = Array.from(new Set(allSnippets));
  const trimmed = unique.slice(0, 20);

  return trimmed.join("\n\n");
}

export function isSerperAvailable(): boolean {
  return !!process.env.SERPER_API_KEY;
}
