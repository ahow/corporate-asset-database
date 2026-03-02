# Corporate Asset Database — API Documentation

**Base URL:** `https://corporate-asset-database-251730b20663.herokuapp.com`

**Authentication:** No authentication required. All endpoints are publicly accessible.

**Content Type:** All responses return `application/json` unless otherwise noted.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Asset Lookup by ISIN](#asset-lookup-by-isin)
3. [Asset Lookup by Company Name](#asset-lookup-by-company-name)
4. [List All Assets](#list-all-assets)
5. [List All Companies](#list-all-companies)
6. [Summary Statistics](#summary-statistics)
7. [Export Assets as CSV](#export-assets-as-csv)
8. [AI Discovery](#ai-discovery)
9. [Discovery Job Management](#discovery-job-management)
10. [System Information](#system-information)
11. [Data Management (CRUD)](#data-management-crud)
12. [Data Dictionary](#data-dictionary)
13. [Error Handling](#error-handling)
14. [Usage Notes](#usage-notes)

---

## Quick Start

The fastest way to retrieve asset data for a company is by its ISIN code:

```bash
curl https://corporate-asset-database-251730b20663.herokuapp.com/api/assets/isin/US88160R1014
```

This returns Tesla's physical assets with locations, valuations, and metadata. See the [ISIN endpoint](#asset-lookup-by-isin) for full details.

---

## Asset Lookup by ISIN

The primary integration endpoint. Returns all physical assets for a company identified by its ISIN code.

**Endpoint:** `GET /api/assets/isin/{isin}`

**Parameters:**

| Parameter | Location | Required | Description |
|-----------|----------|----------|-------------|
| `isin` | Path | Yes | 12-character ISIN code (e.g., `US88160R1014`) |

**Example Request:**

```bash
curl https://corporate-asset-database-251730b20663.herokuapp.com/api/assets/isin/US88160R1014
```

**Example Response:**

```json
{
  "isin": "US88160R1014",
  "company_name": "Tesla, Inc.",
  "sector": "Consumer Discretionary (Automotive & Energy)",
  "total_estimated_value": 163600000000,
  "asset_count": 13,
  "assets": [
    {
      "facility_name": "Gigafactory Texas",
      "asset_type": "Manufacturing Plant",
      "address": "1 Tesla Road, Del Valle, TX",
      "city": "Austin",
      "country": "United States",
      "latitude": 30.2223,
      "longitude": -97.6162,
      "coordinate_certainty": 85,
      "estimated_value_usd": 18200000000,
      "valuation_confidence": 95,
      "ownership_share": 100,
      "data_source": "AI Discovery (DeepSeek)",
      "source_document": "2024 10-K Filing",
      "source_url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001318605"
    }
  ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `isin` | string | The ISIN code that was queried |
| `company_name` | string \| null | Company name, or null if ISIN not found |
| `sector` | string \| null | Industry sector classification |
| `total_estimated_value` | number | Sum of all asset values in USD |
| `asset_count` | number | Number of assets returned |
| `assets` | array | List of asset objects (see [Asset Object](#asset-object) below) |

**When ISIN is not found:** Returns `asset_count: 0` with an empty `assets` array and null for `company_name` and `sector`.

---

## Asset Lookup by Company Name

Returns all assets for a company matched by name.

**Endpoint:** `GET /api/assets/company/{name}`

**Parameters:**

| Parameter | Location | Required | Description |
|-----------|----------|----------|-------------|
| `name` | Path | Yes | Company name (URL-encoded if it contains spaces) |

**Example Request:**

```bash
curl https://corporate-asset-database-251730b20663.herokuapp.com/api/assets/company/Amazon
```

**Example Response:**

```json
{
  "company_name": "Amazon",
  "total_assets": 8,
  "assets": [
    {
      "id": 18,
      "companyName": "Amazon",
      "isin": "US0231351067",
      "facilityName": "AWS EU-West Region",
      "address": null,
      "city": "Dublin",
      "country": "Ireland",
      "latitude": 53.3498,
      "longitude": -6.2603,
      "coordinateCertainty": 7,
      "assetType": "Data Center",
      "valueUsd": 77054029965.75,
      "sizeFactor": 5,
      "geoFactor": 1.9,
      "typeWeight": 1.4,
      "industryFactor": 1.1,
      "valuationConfidence": 85,
      "ownershipShare": 100,
      "sector": "Consumer Discretionary",
      "dataSource": "AWS Infrastructure"
    }
  ]
}
```

---

## List All Assets

Returns every asset in the database along with coverage statistics.

**Endpoint:** `GET /api/assets`

**Example Request:**

```bash
curl https://corporate-asset-database-251730b20663.herokuapp.com/api/assets
```

**Example Response:**

```json
{
  "total_assets": 524,
  "assets_with_coordinates": 524,
  "coordinate_coverage_percent": "100.0",
  "assets": [
    {
      "id": 18,
      "companyName": "Amazon",
      "isin": "US0231351067",
      "facilityName": "AWS EU-West Region",
      "address": null,
      "city": "Dublin",
      "country": "Ireland",
      "latitude": 53.3498,
      "longitude": -6.2603,
      "coordinateCertainty": 7,
      "assetType": "Data Center",
      "valueUsd": 77054029965.75,
      "sizeFactor": 5,
      "geoFactor": 1.9,
      "typeWeight": 1.4,
      "industryFactor": 1.1,
      "valuationConfidence": 85,
      "ownershipShare": 100,
      "sector": "Consumer Discretionary",
      "dataSource": "AWS Infrastructure"
    }
  ]
}
```

**Top-Level Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `total_assets` | number | Total number of assets in the database |
| `assets_with_coordinates` | number | Number of assets that have latitude/longitude coordinates |
| `coordinate_coverage_percent` | string | Percentage of assets with coordinates |
| `assets` | array | Full list of asset objects |

---

## List All Companies

Returns all companies in the database.

**Endpoint:** `GET /api/companies`

**Example Request:**

```bash
curl https://corporate-asset-database-251730b20663.herokuapp.com/api/companies
```

**Example Response:**

```json
[
  {
    "id": 3,
    "isin": "US0231351067",
    "name": "Amazon",
    "sector": "Consumer Discretionary",
    "totalAssets": 527854000000,
    "assetCount": 8
  }
]
```

**Company Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Internal company ID |
| `isin` | string \| null | ISIN code |
| `name` | string | Company name |
| `sector` | string \| null | Industry sector |
| `totalAssets` | number | Total value of all assets in USD |
| `assetCount` | number | Number of physical assets |

---

## Summary Statistics

Returns high-level statistics about the database.

**Endpoint:** `GET /api/stats`

**Example Request:**

```bash
curl https://corporate-asset-database-251730b20663.herokuapp.com/api/stats
```

**Example Response:**

```json
{
  "total_assets": 524,
  "assets_with_coordinates": 524,
  "coordinate_coverage_percent": "100.0"
}
```

---

## Export Assets as CSV

Downloads all assets as a CSV file.

**Endpoint:** `GET /api/assets/export/csv`

**Response:** Returns a CSV file with `Content-Type: text/csv` and `Content-Disposition: attachment; filename="corporate_assets.csv"`.

**CSV Columns:**

| Column | Description |
|--------|-------------|
| Company Name | Name of the parent company |
| ISIN | ISIN code |
| Facility Name | Name of the physical asset |
| Asset Type | Category of the asset |
| Address | Street address |
| City | City |
| Country | Country |
| Latitude | Latitude coordinate |
| Longitude | Longitude coordinate |
| Coordinate Certainty | 0–100 confidence in coordinate accuracy |
| Value (USD) | Estimated value in US dollars |
| Ownership Share (%) | Percentage owned by the company |
| Size Factor | Valuation multiplier for asset size |
| Geo Factor | Valuation multiplier for geographic location |
| Type Weight | Valuation multiplier for asset type |
| Industry Factor | Valuation multiplier for industry |
| Valuation Confidence | 0–100 confidence in the valuation |
| Sector | Industry sector |
| Data Source | Origin of the data |

**Example Request:**

```bash
curl -o corporate_assets.csv https://corporate-asset-database-251730b20663.herokuapp.com/api/assets/export/csv
```

---

## AI Discovery

Start a new AI-powered discovery job to find physical assets for one or more companies. The request returns immediately with a job ID; the discovery runs in the background.

**Endpoint:** `POST /api/discover`

**Request Body (JSON):**

```json
{
  "companies": [
    { "name": "Apple Inc.", "isin": "US0378331005", "totalValue": 350000000000 },
    { "name": "Microsoft" }
  ],
  "provider": "deepseek",
  "supplementaryProvider": "minimax"
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `companies` | array | Yes | Array of company objects or plain strings |
| `companies[].name` | string | Yes | Company name |
| `companies[].isin` | string | No | ISIN code to associate with discovered assets |
| `companies[].totalValue` | number | No | Known total asset value in USD (helps calibrate valuations) |
| `provider` | string | No | Primary AI provider ID. Default: `"openai"`. Options: `openai`, `deepseek`, `gemini`, `claude`, `minimax` |
| `supplementaryProvider` | string | No | Optional second AI provider for additional asset discovery |

**Example Response:**

```json
{
  "jobId": 42,
  "total": 2,
  "provider": "deepseek",
  "status": "pending"
}
```

**How Discovery Works:**
1. **Pass 1:** The AI provider researches each company and identifies its major physical assets (factories, offices, mines, data centers, etc.), providing locations and estimated values.
2. **Pass 2:** The AI reviews Pass 1 results by asset category, identifies gaps, and adds missing assets. Three-layer deduplication prevents duplicates (exact name match, city+type key match, and geographic proximity within 5km).
3. **Supplementary Pass (optional):** If a supplementary provider is specified, a second AI model reviews and adds assets the primary model may have missed.

---

## Discovery Job Management

### Get All Jobs

**Endpoint:** `GET /api/discover/jobs`

Returns a list of all discovery jobs with their status and progress.

### Get Single Job

**Endpoint:** `GET /api/discover/jobs/{id}`

Poll this endpoint to track progress of a running job.

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Job ID |
| `status` | string | `pending`, `running`, `completed`, `failed`, `cancelled` |
| `modelProvider` | string | Primary AI provider used |
| `supplementaryProvider` | string \| null | Secondary AI provider, if any |
| `totalCompanies` | number | Total companies in this job |
| `completedCompanies` | number | Companies processed so far |
| `failedCompanies` | number | Companies that failed to process |
| `companyNames` | string | JSON array of company names |
| `totalInputTokens` | number | Total AI input tokens consumed |
| `totalOutputTokens` | number | Total AI output tokens consumed |
| `totalCostUsd` | number | Estimated cost in USD |
| `results` | string \| null | JSON string of per-company results |
| `createdAt` | string | ISO timestamp of job creation |

### Cancel a Job

**Endpoint:** `POST /api/discover/jobs/{id}/cancel`

Cancels a running or pending job. Returns `{ "success": true }` on success.

### Resume a Job

**Endpoint:** `POST /api/discover/jobs/{id}/resume`

Resumes a cancelled, failed, or interrupted job from where it left off. Returns `{ "success": true }` on success.

---

## System Information

### API Version

**Endpoint:** `GET /api/version`

```json
{
  "version": "v2-twopass",
  "features": ["two-pass-discovery", "web-research-enhanced", "progress-callbacks", "deduplication"],
  "buildTime": "2026-02-27T12:00:00.000Z"
}
```

### Available LLM Providers

**Endpoint:** `GET /api/llm-providers`

Returns a list of configured AI providers with their availability status and cost per token.

### Web Research Status

**Endpoint:** `GET /api/serper/status`

```json
{
  "available": true
}
```

Indicates whether the Serper web research integration is configured and available to enhance discovery results.

### Provider Health Check

**Endpoint:** `GET /api/health/providers`

Returns the configuration status of all AI providers and services.

### Parallel Processing Status

**Endpoint:** `GET /api/parallel-status`

Returns information about parallel processing capability (number of available API key workers per provider).

---

## Data Management (CRUD)

These endpoints allow creating, updating, and deleting assets and companies.

### Assets

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST /api/assets` | Create a new asset | Request body must match the asset insert schema |
| `PUT /api/assets/{id}` | Update an existing asset | Partial updates supported |
| `DELETE /api/assets/{id}` | Delete an asset | Returns `{ "message": "Asset deleted" }` |

### Companies

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST /api/companies` | Create a new company | Request body must match the company insert schema |
| `PUT /api/companies/{id}` | Update an existing company | Partial updates supported |
| `DELETE /api/companies/{id}` | Delete a company | Returns `{ "message": "Company deleted" }` |

---

## Data Dictionary

### Asset Object

The full asset object returned by the `/api/assets` and `/api/assets/company/{name}` endpoints:

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Internal asset ID |
| `companyName` | string | Parent company name |
| `isin` | string \| null | ISIN code of the parent company |
| `facilityName` | string | Name of the facility or asset |
| `assetType` | string | Category (see Asset Types below) |
| `address` | string \| null | Street address (may be partial or null) |
| `city` | string | City |
| `country` | string | Country |
| `latitude` | number | Latitude coordinate |
| `longitude` | number | Longitude coordinate |
| `coordinateCertainty` | number | 0–100 confidence score for coordinate accuracy |
| `valueUsd` | number | Estimated value in US dollars |
| `sizeFactor` | number | Multiplier based on facility size (1–5) |
| `geoFactor` | number | Multiplier based on geographic location |
| `typeWeight` | number | Multiplier based on asset type |
| `industryFactor` | number | Multiplier based on industry sector |
| `valuationConfidence` | number | 0–100 confidence score for the valuation |
| `ownershipShare` | number | Percentage ownership (0–100) |
| `sector` | string | Industry sector |
| `dataSource` | string | How the data was obtained |
| `sourceDocument` | string \| null | Specific source document (e.g., "2024 10-K Filing", "2024 Annual Report") |
| `sourceUrl` | string \| null | URL to the source document or company investor relations page |

### Cleaned Asset Object (ISIN Endpoint)

The `/api/assets/isin/{isin}` endpoint returns a simplified asset format without internal IDs or valuation factors:

| Field | Type | Description |
|-------|------|-------------|
| `facility_name` | string | Name of the facility |
| `asset_type` | string | Category of the asset |
| `address` | string \| null | Street address |
| `city` | string | City |
| `country` | string | Country |
| `latitude` | number | Latitude coordinate |
| `longitude` | number | Longitude coordinate |
| `coordinate_certainty` | number | 0–100 confidence in coordinate accuracy |
| `estimated_value_usd` | number | Estimated value in USD |
| `valuation_confidence` | number | 0–100 confidence in valuation |
| `ownership_share` | number | Percentage ownership (0–100) |
| `data_source` | string | Origin of the data |
| `source_document` | string \| null | Specific source document (e.g., "2024 10-K Filing", "2024 Annual Report") |
| `source_url` | string \| null | URL to the source document or company investor relations page |

### Common Asset Types

- Manufacturing Plant
- Headquarters
- Data Center
- Warehouse / Distribution Center
- Research Facility / R&D Center
- Mine / Mining Operation
- Refinery
- Power Plant
- Office
- Retail Store
- Processing Facility
- Port / Terminal
- Pipeline

### Interpreting Confidence Scores

- **`coordinate_certainty` / `coordinateCertainty`**: How confident the system is in the latitude/longitude. Values above 80 indicate precise, verified coordinates. Values below 50 suggest the coordinates are approximate (e.g., city-center placement).
- **`valuation_confidence` / `valuationConfidence`**: How confident the system is in the estimated value. Values above 80 indicate strong data support. Values below 50 suggest the valuation is a rough estimate.

### Interpreting Ownership Share

- `100` — Fully owned by the company
- `50` — Joint venture with equal ownership
- Values below 100 indicate the company owns a fraction of the asset. To calculate the company's share of the value: `estimated_value_usd * ownership_share / 100`

---

## Error Handling

All endpoints return standard HTTP status codes:

| Status | Meaning |
|--------|---------|
| `200` | Success |
| `201` | Created (for POST requests) |
| `400` | Bad request (invalid parameters or body) |
| `404` | Resource not found |
| `500` | Internal server error |

Error responses follow this format:

```json
{
  "message": "Description of what went wrong"
}
```

---

## Usage Notes

1. **No authentication** is required. The API is publicly accessible.
2. **Rate limiting** is not currently enforced, but please use the API responsibly.
3. **Values are estimates.** Asset valuations and coordinates are derived from AI analysis of public information. Always check the confidence scores before relying on values for critical decisions.
4. **ISIN endpoint is the recommended integration point.** It returns clean, snake_case field names and excludes internal implementation details.
5. **Discovery jobs run in the background.** After starting a job with `POST /api/discover`, poll `GET /api/discover/jobs/{id}` to check progress. Do not restart the server while jobs are running — job state is held in memory.
6. **CSV export** provides a complete download of all data for offline analysis or import into spreadsheets and other systems.
