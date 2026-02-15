import { storage } from "./storage";
import type { InsertCompany, InsertAsset } from "@shared/schema";

const SEED_COMPANIES: InsertCompany[] = [
  { isin: "US0378331005", name: "Apple", sector: "Technology", totalAssets: 352583000000, assetCount: 28 },
  { isin: "US5949181045", name: "Microsoft", sector: "Technology", totalAssets: 411976000000, assetCount: 24 },
  { isin: "US0231351067", name: "Amazon", sector: "Consumer Discretionary", totalAssets: 527854000000, assetCount: 35 },
  { isin: "US30303M1027", name: "Meta Platforms", sector: "Technology", totalAssets: 185727000000, assetCount: 18 },
  { isin: "US88160R1014", name: "Tesla", sector: "Consumer Discretionary", totalAssets: 106618000000, assetCount: 22 },
  { isin: "US1264081035", name: "CSX", sector: "Industrials", totalAssets: 42764000000, assetCount: 15 },
  { isin: "US4592001014", name: "IBM", sector: "Technology", totalAssets: 127243000000, assetCount: 20 },
  { isin: "US46625H1005", name: "JPMorgan Chase", sector: "Financials", totalAssets: 3875393000000, assetCount: 30 },
  { isin: "US7427181091", name: "Procter & Gamble", sector: "Consumer Staples", totalAssets: 120829000000, assetCount: 25 },
  { isin: "US1912161007", name: "Coca-Cola", sector: "Consumer Staples", totalAssets: 97703000000, assetCount: 22 },
  { isin: "US2546871060", name: "Walt Disney", sector: "Communication Services", totalAssets: 205579000000, assetCount: 20 },
  { isin: "US7170811035", name: "Pfizer", sector: "Health Care", totalAssets: 197244000000, assetCount: 26 },
  { isin: "US20825C1045", name: "ConocoPhillips", sector: "Energy", totalAssets: 93892000000, assetCount: 18 },
  { isin: "US2605571031", name: "Dow Inc", sector: "Materials", totalAssets: 55888000000, assetCount: 16 },
  { isin: "US6293775085", name: "NextEra Energy", sector: "Utilities", totalAssets: 98887000000, assetCount: 20 },
];

interface SeedAsset extends InsertAsset {
  companyName: string;
}

function generateAssets(): InsertAsset[] {
  const allAssets: InsertAsset[] = [];

  const companyFacilities: Record<string, Omit<InsertAsset, "companyName" | "isin" | "sector">[]> = {
    Apple: [
      { facilityName: "Apple Park", assetType: "Headquarters", address: "One Apple Park Way", city: "Cupertino", country: "United States", latitude: 37.3349, longitude: -122.0090, coordinateCertainty: 10, sizeFactor: 5.0, geoFactor: 2.5, typeWeight: 1.2, industryFactor: 0.9, valuationConfidence: 95, dataSource: "Apple 2024 10-K" },
      { facilityName: "Austin Campus", assetType: "Office", address: "12545 Riata Vista Cir", city: "Austin", country: "United States", latitude: 30.4183, longitude: -97.7197, coordinateCertainty: 10, sizeFactor: 4.0, geoFactor: 1.5, typeWeight: 1.0, industryFactor: 0.9, valuationConfidence: 90, dataSource: "Apple 2024 10-K" },
      { facilityName: "Reno Data Center", assetType: "Data Center", address: "Reno Technology Park", city: "Reno", country: "United States", latitude: 39.5296, longitude: -119.8138, coordinateCertainty: 7, sizeFactor: 4.5, geoFactor: 1.2, typeWeight: 1.4, industryFactor: 0.9, valuationConfidence: 85, dataSource: "Apple 2024 10-K" },
      { facilityName: "Mesa Data Center", assetType: "Data Center", city: "Mesa", country: "United States", latitude: 33.4152, longitude: -111.8315, coordinateCertainty: 7, sizeFactor: 4.0, geoFactor: 1.2, typeWeight: 1.4, industryFactor: 0.9, valuationConfidence: 85, dataSource: "Apple 2024 10-K" },
      { facilityName: "Cork Campus", assetType: "Office", city: "Cork", country: "Ireland", latitude: 51.8969, longitude: -8.4863, coordinateCertainty: 7, sizeFactor: 3.5, geoFactor: 1.8, typeWeight: 1.0, industryFactor: 0.9, valuationConfidence: 80, dataSource: "Apple 2024 10-K" },
      { facilityName: "London Office", assetType: "Office", city: "London", country: "United Kingdom", latitude: 51.5074, longitude: -0.1278, coordinateCertainty: 7, sizeFactor: 2.5, geoFactor: 2.1, typeWeight: 1.0, industryFactor: 0.9, valuationConfidence: 80, dataSource: "Apple 2024 10-K" },
      { facilityName: "Shanghai R&D Center", assetType: "Research Center", city: "Shanghai", country: "China", latitude: 31.2304, longitude: 121.4737, coordinateCertainty: 7, sizeFactor: 3.0, geoFactor: 1.7, typeWeight: 1.1, industryFactor: 0.9, valuationConfidence: 75, dataSource: "Press release 2023" },
      { facilityName: "Maiden Data Center", assetType: "Data Center", city: "Maiden", country: "United States", latitude: 35.5758, longitude: -81.3818, coordinateCertainty: 7, sizeFactor: 4.5, geoFactor: 1.0, typeWeight: 1.4, industryFactor: 0.9, valuationConfidence: 85, dataSource: "Apple 2024 10-K" },
    ],
    Microsoft: [
      { facilityName: "Microsoft Campus", assetType: "Headquarters", address: "One Microsoft Way", city: "Redmond", country: "United States", latitude: 47.6397, longitude: -122.1285, coordinateCertainty: 10, sizeFactor: 5.0, geoFactor: 2.3, typeWeight: 1.2, industryFactor: 0.9, valuationConfidence: 95, dataSource: "Microsoft 2024 10-K" },
      { facilityName: "Quincy Data Center", assetType: "Data Center", city: "Quincy", country: "United States", latitude: 47.2343, longitude: -119.8526, coordinateCertainty: 7, sizeFactor: 5.0, geoFactor: 1.0, typeWeight: 1.4, industryFactor: 0.9, valuationConfidence: 85, dataSource: "Microsoft 2024 10-K" },
      { facilityName: "San Antonio Data Center", assetType: "Data Center", city: "San Antonio", country: "United States", latitude: 29.4241, longitude: -98.4936, coordinateCertainty: 7, sizeFactor: 4.5, geoFactor: 1.3, typeWeight: 1.4, industryFactor: 0.9, valuationConfidence: 85, dataSource: "Microsoft 2024 10-K" },
      { facilityName: "Dublin Data Center", assetType: "Data Center", city: "Dublin", country: "Ireland", latitude: 53.3498, longitude: -6.2603, coordinateCertainty: 7, sizeFactor: 4.0, geoFactor: 1.9, typeWeight: 1.4, industryFactor: 0.9, valuationConfidence: 80, dataSource: "Microsoft 2024 10-K" },
      { facilityName: "Singapore Office", assetType: "Office", city: "Singapore", country: "Singapore", latitude: 1.2966, longitude: 103.7764, coordinateCertainty: 7, sizeFactor: 2.5, geoFactor: 1.9, typeWeight: 1.0, industryFactor: 0.9, valuationConfidence: 80, dataSource: "Microsoft 2024 10-K" },
      { facilityName: "Hyderabad Campus", assetType: "Office", city: "Hyderabad", country: "India", latitude: 17.3850, longitude: 78.4867, coordinateCertainty: 7, sizeFactor: 3.5, geoFactor: 0.8, typeWeight: 1.0, industryFactor: 0.9, valuationConfidence: 75, dataSource: "Microsoft 2024 10-K" },
    ],
    Amazon: [
      { facilityName: "HQ2 - Arlington", assetType: "Headquarters", city: "Arlington", country: "United States", latitude: 38.8816, longitude: -77.0910, coordinateCertainty: 7, sizeFactor: 5.0, geoFactor: 2.2, typeWeight: 1.2, industryFactor: 1.1, valuationConfidence: 90, dataSource: "Amazon 2024 10-K" },
      { facilityName: "Seattle Day 1 Tower", assetType: "Headquarters", city: "Seattle", country: "United States", latitude: 47.6155, longitude: -122.3391, coordinateCertainty: 10, sizeFactor: 5.0, geoFactor: 2.3, typeWeight: 1.2, industryFactor: 1.1, valuationConfidence: 95, dataSource: "Amazon 2024 10-K" },
      { facilityName: "US East Data Center", assetType: "Data Center", city: "Ashburn", country: "United States", latitude: 39.0438, longitude: -77.4874, coordinateCertainty: 7, sizeFactor: 5.0, geoFactor: 2.0, typeWeight: 1.4, industryFactor: 1.1, valuationConfidence: 85, dataSource: "AWS Infrastructure" },
      { facilityName: "AWS EU-West Region", assetType: "Data Center", city: "Dublin", country: "Ireland", latitude: 53.3498, longitude: -6.2603, coordinateCertainty: 7, sizeFactor: 5.0, geoFactor: 1.9, typeWeight: 1.4, industryFactor: 1.1, valuationConfidence: 85, dataSource: "AWS Infrastructure" },
      { facilityName: "Bessemer Fulfillment Center", assetType: "Distribution Center", city: "Bessemer", country: "United States", latitude: 33.3487, longitude: -86.9542, coordinateCertainty: 7, sizeFactor: 3.5, geoFactor: 1.1, typeWeight: 1.1, industryFactor: 1.1, valuationConfidence: 80, dataSource: "Amazon 2024 10-K" },
      { facilityName: "Kenosha Fulfillment Center", assetType: "Distribution Center", city: "Kenosha", country: "United States", latitude: 42.5847, longitude: -87.8212, coordinateCertainty: 7, sizeFactor: 3.0, geoFactor: 1.2, typeWeight: 1.1, industryFactor: 1.1, valuationConfidence: 80, dataSource: "Amazon 2024 10-K" },
      { facilityName: "Tokyo AWS Region", assetType: "Data Center", city: "Tokyo", country: "Japan", latitude: 35.6762, longitude: 139.6503, coordinateCertainty: 7, sizeFactor: 4.5, geoFactor: 2.2, typeWeight: 1.4, industryFactor: 1.1, valuationConfidence: 80, dataSource: "AWS Infrastructure" },
      { facilityName: "Mumbai Fulfillment Center", assetType: "Distribution Center", city: "Mumbai", country: "India", latitude: 19.0760, longitude: 72.8777, coordinateCertainty: 7, sizeFactor: 2.5, geoFactor: 0.9, typeWeight: 1.1, industryFactor: 1.1, valuationConfidence: 75, dataSource: "Amazon 2024 10-K" },
    ],
    "Meta Platforms": [
      { facilityName: "Menlo Park Campus", assetType: "Headquarters", city: "Menlo Park", country: "United States", latitude: 37.4530, longitude: -122.1817, coordinateCertainty: 10, sizeFactor: 5.0, geoFactor: 2.5, typeWeight: 1.2, industryFactor: 0.9, valuationConfidence: 95, dataSource: "Meta 2024 10-K" },
      { facilityName: "Prineville Data Center", assetType: "Data Center", city: "Prineville", country: "United States", latitude: 44.2999, longitude: -120.7343, coordinateCertainty: 7, sizeFactor: 5.0, geoFactor: 1.0, typeWeight: 1.4, industryFactor: 0.9, valuationConfidence: 85, dataSource: "Meta 2024 10-K" },
      { facilityName: "Lulea Data Center", assetType: "Data Center", city: "Lulea", country: "Sweden", latitude: 65.5842, longitude: 22.1465, coordinateCertainty: 7, sizeFactor: 4.5, geoFactor: 1.5, typeWeight: 1.4, industryFactor: 0.9, valuationConfidence: 80, dataSource: "Meta 2024 10-K" },
      { facilityName: "New Albany Data Center", assetType: "Data Center", city: "New Albany", country: "United States", latitude: 40.0812, longitude: -82.8085, coordinateCertainty: 7, sizeFactor: 4.5, geoFactor: 1.1, typeWeight: 1.4, industryFactor: 0.9, valuationConfidence: 85, dataSource: "Meta 2024 10-K" },
      { facilityName: "London Office", assetType: "Office", city: "London", country: "United Kingdom", latitude: 51.5074, longitude: -0.1278, coordinateCertainty: 7, sizeFactor: 3.0, geoFactor: 2.1, typeWeight: 1.0, industryFactor: 0.9, valuationConfidence: 80, dataSource: "Meta 2024 10-K" },
    ],
    Tesla: [
      { facilityName: "Gigafactory Texas", assetType: "Manufacturing Plant", city: "Austin", country: "United States", latitude: 30.2223, longitude: -97.6162, coordinateCertainty: 10, sizeFactor: 5.0, geoFactor: 1.5, typeWeight: 1.3, industryFactor: 1.1, valuationConfidence: 95, dataSource: "Tesla 2024 10-K" },
      { facilityName: "Fremont Factory", assetType: "Manufacturing Plant", city: "Fremont", country: "United States", latitude: 37.4937, longitude: -121.9445, coordinateCertainty: 10, sizeFactor: 5.0, geoFactor: 2.5, typeWeight: 1.3, industryFactor: 1.1, valuationConfidence: 95, dataSource: "Tesla 2024 10-K" },
      { facilityName: "Gigafactory Nevada", assetType: "Manufacturing Plant", city: "Sparks", country: "United States", latitude: 39.5380, longitude: -119.4409, coordinateCertainty: 10, sizeFactor: 5.0, geoFactor: 1.2, typeWeight: 1.3, industryFactor: 1.1, valuationConfidence: 95, dataSource: "Tesla 2024 10-K" },
      { facilityName: "Gigafactory Shanghai", assetType: "Manufacturing Plant", city: "Shanghai", country: "China", latitude: 31.0965, longitude: 121.7785, coordinateCertainty: 10, sizeFactor: 5.0, geoFactor: 1.7, typeWeight: 1.3, industryFactor: 1.1, valuationConfidence: 90, dataSource: "Tesla 2024 10-K" },
      { facilityName: "Gigafactory Berlin", assetType: "Manufacturing Plant", city: "Grunheide", country: "Germany", latitude: 52.3961, longitude: 13.7881, coordinateCertainty: 10, sizeFactor: 5.0, geoFactor: 1.8, typeWeight: 1.3, industryFactor: 1.1, valuationConfidence: 90, dataSource: "Tesla 2024 10-K" },
      { facilityName: "Megapack Factory", assetType: "Manufacturing Plant", city: "Lathrop", country: "United States", latitude: 37.8230, longitude: -121.2711, coordinateCertainty: 7, sizeFactor: 3.5, geoFactor: 1.8, typeWeight: 1.3, industryFactor: 1.1, valuationConfidence: 85, dataSource: "Tesla 2024 10-K" },
    ],
    CSX: [
      { facilityName: "Jacksonville Headquarters", assetType: "Headquarters", city: "Jacksonville", country: "United States", latitude: 30.3322, longitude: -81.6557, coordinateCertainty: 7, sizeFactor: 2.5, geoFactor: 1.2, typeWeight: 1.2, industryFactor: 1.3, valuationConfidence: 90, dataSource: "CSX 2024 10-K" },
      { facilityName: "Bedford Park Intermodal Terminal", assetType: "Intermodal Terminal", address: "6400 W 73rd St, Bedford Park, IL 60638", city: "Bedford Park", country: "United States", latitude: 41.7647, longitude: -87.8089, coordinateCertainty: 10, sizeFactor: 5.0, geoFactor: 1.4, typeWeight: 1.0, industryFactor: 1.3, valuationConfidence: 85, dataSource: "CSX 2024 10-K" },
      { facilityName: "Waycross Rice Yard", assetType: "Rail Yard", city: "Waycross", country: "United States", latitude: 31.2136, longitude: -82.3540, coordinateCertainty: 7, sizeFactor: 4.0, geoFactor: 1.0, typeWeight: 1.0, industryFactor: 1.3, valuationConfidence: 80, dataSource: "CSX 2024 10-K" },
      { facilityName: "Selkirk Rail Yard", assetType: "Rail Yard", city: "Selkirk", country: "United States", latitude: 42.5398, longitude: -73.8348, coordinateCertainty: 7, sizeFactor: 3.5, geoFactor: 1.3, typeWeight: 1.0, industryFactor: 1.3, valuationConfidence: 80, dataSource: "CSX 2024 10-K" },
      { facilityName: "Cumberland Maintenance Shop", assetType: "Maintenance Facility", city: "Cumberland", country: "United States", latitude: 39.6529, longitude: -78.7625, coordinateCertainty: 7, sizeFactor: 2.0, geoFactor: 1.0, typeWeight: 0.9, industryFactor: 1.3, valuationConfidence: 75, dataSource: "CSX 2024 10-K" },
    ],
    IBM: [
      { facilityName: "IBM Research - Yorktown", assetType: "Research Center", city: "Yorktown Heights", country: "United States", latitude: 41.2112, longitude: -73.7862, coordinateCertainty: 7, sizeFactor: 4.0, geoFactor: 2.0, typeWeight: 1.1, industryFactor: 0.9, valuationConfidence: 85, dataSource: "IBM 2024 10-K" },
      { facilityName: "Armonk Headquarters", assetType: "Headquarters", city: "Armonk", country: "United States", latitude: 41.1260, longitude: -73.7143, coordinateCertainty: 7, sizeFactor: 3.0, geoFactor: 2.0, typeWeight: 1.2, industryFactor: 0.9, valuationConfidence: 90, dataSource: "IBM 2024 10-K" },
      { facilityName: "Poughkeepsie Data Center", assetType: "Data Center", city: "Poughkeepsie", country: "United States", latitude: 41.6922, longitude: -73.9156, coordinateCertainty: 7, sizeFactor: 4.0, geoFactor: 1.5, typeWeight: 1.4, industryFactor: 0.9, valuationConfidence: 85, dataSource: "IBM 2024 10-K" },
      { facilityName: "Bangalore Technology Park", assetType: "Office", city: "Bangalore", country: "India", latitude: 12.9716, longitude: 77.5946, coordinateCertainty: 7, sizeFactor: 3.5, geoFactor: 0.8, typeWeight: 1.0, industryFactor: 0.9, valuationConfidence: 75, dataSource: "IBM 2024 10-K" },
      { facilityName: "Hursley Laboratory", assetType: "Research Center", city: "Winchester", country: "United Kingdom", latitude: 51.0215, longitude: -1.3099, coordinateCertainty: 7, sizeFactor: 2.5, geoFactor: 1.8, typeWeight: 1.1, industryFactor: 0.9, valuationConfidence: 80, dataSource: "IBM 2024 10-K" },
    ],
    "JPMorgan Chase": [
      { facilityName: "270 Park Avenue (New HQ)", assetType: "Headquarters", address: "270 Park Avenue", city: "New York", country: "United States", latitude: 40.7558, longitude: -73.9749, coordinateCertainty: 10, sizeFactor: 5.0, geoFactor: 2.3, typeWeight: 1.2, industryFactor: 0.8, valuationConfidence: 95, dataSource: "JPM 2024 10-K" },
      { facilityName: "Columbus Technology Center", assetType: "Data Center", city: "Columbus", country: "United States", latitude: 39.9612, longitude: -82.9988, coordinateCertainty: 7, sizeFactor: 4.0, geoFactor: 1.3, typeWeight: 1.4, industryFactor: 0.8, valuationConfidence: 85, dataSource: "JPM 2024 10-K" },
      { facilityName: "London Canary Wharf Office", assetType: "Office", city: "London", country: "United Kingdom", latitude: 51.5049, longitude: -0.0197, coordinateCertainty: 10, sizeFactor: 4.0, geoFactor: 2.1, typeWeight: 1.0, industryFactor: 0.8, valuationConfidence: 90, dataSource: "JPM 2024 10-K" },
      { facilityName: "Hong Kong Office", assetType: "Office", city: "Hong Kong", country: "China", latitude: 22.2783, longitude: 114.1747, coordinateCertainty: 7, sizeFactor: 3.0, geoFactor: 2.0, typeWeight: 1.0, industryFactor: 0.8, valuationConfidence: 80, dataSource: "JPM 2024 10-K" },
      { facilityName: "Wilmington Operations Center", assetType: "Office", city: "Wilmington", country: "United States", latitude: 39.7391, longitude: -75.5398, coordinateCertainty: 7, sizeFactor: 3.0, geoFactor: 1.3, typeWeight: 1.0, industryFactor: 0.8, valuationConfidence: 80, dataSource: "JPM 2024 10-K" },
      { facilityName: "Mumbai Branch", assetType: "Retail Location", city: "Mumbai", country: "India", latitude: 19.0760, longitude: 72.8777, coordinateCertainty: 7, sizeFactor: 1.5, geoFactor: 0.9, typeWeight: 0.8, industryFactor: 0.8, valuationConfidence: 70, dataSource: "JPM 2024 10-K" },
    ],
    "Procter & Gamble": [
      { facilityName: "P&G Headquarters", assetType: "Headquarters", address: "One P&G Plaza", city: "Cincinnati", country: "United States", latitude: 39.1027, longitude: -84.5120, coordinateCertainty: 10, sizeFactor: 4.0, geoFactor: 1.3, typeWeight: 1.2, industryFactor: 1.1, valuationConfidence: 95, dataSource: "P&G 2024 10-K" },
      { facilityName: "Lima Manufacturing Plant", assetType: "Manufacturing Plant", city: "Lima", country: "United States", latitude: 40.7428, longitude: -84.1052, coordinateCertainty: 7, sizeFactor: 3.5, geoFactor: 1.0, typeWeight: 1.3, industryFactor: 1.1, valuationConfidence: 80, dataSource: "P&G 2024 10-K" },
      { facilityName: "Guangzhou Plant", assetType: "Manufacturing Plant", city: "Guangzhou", country: "China", latitude: 23.1291, longitude: 113.2644, coordinateCertainty: 7, sizeFactor: 3.5, geoFactor: 1.5, typeWeight: 1.3, industryFactor: 1.1, valuationConfidence: 75, dataSource: "P&G 2024 10-K" },
      { facilityName: "Brussels Innovation Center", assetType: "Research Center", city: "Brussels", country: "Belgium", latitude: 50.8503, longitude: 4.3517, coordinateCertainty: 7, sizeFactor: 2.5, geoFactor: 1.7, typeWeight: 1.1, industryFactor: 1.1, valuationConfidence: 80, dataSource: "P&G 2024 10-K" },
      { facilityName: "Takasaki Plant", assetType: "Manufacturing Plant", city: "Takasaki", country: "Japan", latitude: 36.3219, longitude: 139.0032, coordinateCertainty: 7, sizeFactor: 3.0, geoFactor: 1.8, typeWeight: 1.3, industryFactor: 1.1, valuationConfidence: 75, dataSource: "P&G 2024 10-K" },
    ],
    "Coca-Cola": [
      { facilityName: "World of Coca-Cola HQ", assetType: "Headquarters", city: "Atlanta", country: "United States", latitude: 33.7629, longitude: -84.3928, coordinateCertainty: 10, sizeFactor: 4.0, geoFactor: 1.4, typeWeight: 1.2, industryFactor: 1.1, valuationConfidence: 95, dataSource: "Coca-Cola 2024 10-K" },
      { facilityName: "Greifswald Bottling Plant", assetType: "Manufacturing Plant", city: "Greifswald", country: "Germany", latitude: 54.0887, longitude: 13.3806, coordinateCertainty: 7, sizeFactor: 2.5, geoFactor: 1.5, typeWeight: 1.3, industryFactor: 1.1, valuationConfidence: 75, dataSource: "Coca-Cola 2024 10-K" },
      { facilityName: "Houston Syrup Plant", assetType: "Manufacturing Plant", city: "Houston", country: "United States", latitude: 29.7604, longitude: -95.3698, coordinateCertainty: 7, sizeFactor: 3.5, geoFactor: 1.3, typeWeight: 1.3, industryFactor: 1.1, valuationConfidence: 80, dataSource: "Coca-Cola 2024 10-K" },
      { facilityName: "Nairobi Bottling Plant", assetType: "Manufacturing Plant", city: "Nairobi", country: "Kenya", latitude: -1.2921, longitude: 36.8219, coordinateCertainty: 7, sizeFactor: 2.0, geoFactor: 0.7, typeWeight: 1.3, industryFactor: 1.1, valuationConfidence: 70, dataSource: "Coca-Cola 2024 10-K" },
      { facilityName: "Shanghai Distribution Center", assetType: "Distribution Center", city: "Shanghai", country: "China", latitude: 31.2304, longitude: 121.4737, coordinateCertainty: 7, sizeFactor: 2.5, geoFactor: 1.7, typeWeight: 1.1, industryFactor: 1.1, valuationConfidence: 75, dataSource: "Coca-Cola 2024 10-K" },
    ],
    "Walt Disney": [
      { facilityName: "Walt Disney World Resort", assetType: "Theme Park", city: "Orlando", country: "United States", latitude: 28.3852, longitude: -81.5639, coordinateCertainty: 10, sizeFactor: 5.0, geoFactor: 1.3, typeWeight: 1.5, industryFactor: 1.0, valuationConfidence: 95, dataSource: "Disney 2024 10-K" },
      { facilityName: "Disneyland Resort", assetType: "Theme Park", city: "Anaheim", country: "United States", latitude: 33.8121, longitude: -117.9190, coordinateCertainty: 10, sizeFactor: 5.0, geoFactor: 2.0, typeWeight: 1.5, industryFactor: 1.0, valuationConfidence: 95, dataSource: "Disney 2024 10-K" },
      { facilityName: "Burbank Studios", assetType: "Headquarters", city: "Burbank", country: "United States", latitude: 34.1563, longitude: -118.3254, coordinateCertainty: 10, sizeFactor: 4.0, geoFactor: 2.0, typeWeight: 1.2, industryFactor: 1.0, valuationConfidence: 90, dataSource: "Disney 2024 10-K" },
      { facilityName: "Tokyo Disney Resort", assetType: "Theme Park", city: "Urayasu", country: "Japan", latitude: 35.6329, longitude: 139.8804, coordinateCertainty: 10, sizeFactor: 4.5, geoFactor: 2.2, typeWeight: 1.5, industryFactor: 1.0, valuationConfidence: 85, dataSource: "Disney 2024 10-K" },
      { facilityName: "Disneyland Paris", assetType: "Theme Park", city: "Chessy", country: "France", latitude: 48.8674, longitude: 2.7836, coordinateCertainty: 10, sizeFactor: 4.0, geoFactor: 2.0, typeWeight: 1.5, industryFactor: 1.0, valuationConfidence: 85, dataSource: "Disney 2024 10-K" },
    ],
    Pfizer: [
      { facilityName: "Pfizer World Headquarters", assetType: "Headquarters", address: "66 Hudson Blvd E", city: "New York", country: "United States", latitude: 40.7539, longitude: -73.9984, coordinateCertainty: 10, sizeFactor: 4.0, geoFactor: 2.3, typeWeight: 1.2, industryFactor: 1.0, valuationConfidence: 95, dataSource: "Pfizer 2024 10-K" },
      { facilityName: "Groton Research Labs", assetType: "Research Center", city: "Groton", country: "United States", latitude: 41.3474, longitude: -72.0717, coordinateCertainty: 7, sizeFactor: 4.5, geoFactor: 1.5, typeWeight: 1.1, industryFactor: 1.0, valuationConfidence: 90, dataSource: "Pfizer 2024 10-K" },
      { facilityName: "Kalamazoo Manufacturing", assetType: "Manufacturing Plant", city: "Kalamazoo", country: "United States", latitude: 42.2917, longitude: -85.5872, coordinateCertainty: 7, sizeFactor: 4.0, geoFactor: 1.1, typeWeight: 1.3, industryFactor: 1.0, valuationConfidence: 85, dataSource: "Pfizer 2024 10-K" },
      { facilityName: "Puurs Manufacturing", assetType: "Manufacturing Plant", city: "Puurs", country: "Belgium", latitude: 51.0713, longitude: 4.2834, coordinateCertainty: 7, sizeFactor: 4.5, geoFactor: 1.7, typeWeight: 1.3, industryFactor: 1.0, valuationConfidence: 85, dataSource: "Pfizer 2024 10-K" },
      { facilityName: "Sandwich Research Site", assetType: "Research Center", city: "Sandwich", country: "United Kingdom", latitude: 51.2744, longitude: 1.3337, coordinateCertainty: 7, sizeFactor: 3.0, geoFactor: 1.8, typeWeight: 1.1, industryFactor: 1.0, valuationConfidence: 80, dataSource: "Pfizer 2024 10-K" },
    ],
    ConocoPhillips: [
      { facilityName: "Houston Headquarters", assetType: "Headquarters", city: "Houston", country: "United States", latitude: 29.7544, longitude: -95.3657, coordinateCertainty: 7, sizeFactor: 3.5, geoFactor: 1.3, typeWeight: 1.2, industryFactor: 1.4, valuationConfidence: 90, dataSource: "ConocoPhillips 2024 10-K" },
      { facilityName: "Prudhoe Bay Operations", assetType: "Extraction Site", city: "Prudhoe Bay", country: "United States", latitude: 70.2553, longitude: -148.3373, coordinateCertainty: 7, sizeFactor: 5.0, geoFactor: 0.8, typeWeight: 1.5, industryFactor: 1.4, valuationConfidence: 85, dataSource: "ConocoPhillips 2024 10-K" },
      { facilityName: "Surmont SAGD Facility", assetType: "Extraction Site", city: "Fort McMurray", country: "Canada", latitude: 56.7264, longitude: -111.3803, coordinateCertainty: 7, sizeFactor: 4.5, geoFactor: 1.0, typeWeight: 1.5, industryFactor: 1.4, valuationConfidence: 80, dataSource: "ConocoPhillips 2024 10-K" },
      { facilityName: "Permian Basin Operations", assetType: "Extraction Site", city: "Midland", country: "United States", latitude: 31.9973, longitude: -102.0779, coordinateCertainty: 7, sizeFactor: 5.0, geoFactor: 0.9, typeWeight: 1.5, industryFactor: 1.4, valuationConfidence: 85, dataSource: "ConocoPhillips 2024 10-K" },
      { facilityName: "Bartlesville Technology Center", assetType: "Research Center", city: "Bartlesville", country: "United States", latitude: 36.7476, longitude: -95.9803, coordinateCertainty: 7, sizeFactor: 2.5, geoFactor: 1.0, typeWeight: 1.1, industryFactor: 1.4, valuationConfidence: 80, dataSource: "ConocoPhillips 2024 10-K" },
    ],
    "Dow Inc": [
      { facilityName: "Midland Headquarters", assetType: "Headquarters", city: "Midland", country: "United States", latitude: 43.6156, longitude: -84.2472, coordinateCertainty: 7, sizeFactor: 3.5, geoFactor: 1.1, typeWeight: 1.2, industryFactor: 1.2, valuationConfidence: 90, dataSource: "Dow 2024 10-K" },
      { facilityName: "Freeport Chemical Complex", assetType: "Manufacturing Plant", city: "Freeport", country: "United States", latitude: 28.9541, longitude: -95.3597, coordinateCertainty: 7, sizeFactor: 5.0, geoFactor: 1.2, typeWeight: 1.3, industryFactor: 1.2, valuationConfidence: 85, dataSource: "Dow 2024 10-K" },
      { facilityName: "Terneuzen Complex", assetType: "Manufacturing Plant", city: "Terneuzen", country: "Netherlands", latitude: 51.3360, longitude: 3.8278, coordinateCertainty: 7, sizeFactor: 4.5, geoFactor: 1.7, typeWeight: 1.3, industryFactor: 1.2, valuationConfidence: 80, dataSource: "Dow 2024 10-K" },
      { facilityName: "Stade Complex", assetType: "Manufacturing Plant", city: "Stade", country: "Germany", latitude: 53.5923, longitude: 9.4765, coordinateCertainty: 7, sizeFactor: 4.0, geoFactor: 1.6, typeWeight: 1.3, industryFactor: 1.2, valuationConfidence: 80, dataSource: "Dow 2024 10-K" },
      { facilityName: "Map Ta Phut Complex", assetType: "Manufacturing Plant", city: "Rayong", country: "Thailand", latitude: 12.6800, longitude: 101.1620, coordinateCertainty: 7, sizeFactor: 3.5, geoFactor: 0.9, typeWeight: 1.3, industryFactor: 1.2, valuationConfidence: 75, dataSource: "Dow 2024 10-K" },
    ],
    "NextEra Energy": [
      { facilityName: "Juno Beach Headquarters", assetType: "Headquarters", city: "Juno Beach", country: "United States", latitude: 26.8795, longitude: -80.0533, coordinateCertainty: 7, sizeFactor: 3.0, geoFactor: 1.4, typeWeight: 1.2, industryFactor: 1.5, valuationConfidence: 90, dataSource: "NextEra 2024 10-K" },
      { facilityName: "Turkey Point Nuclear Plant", assetType: "Power Plant", city: "Homestead", country: "United States", latitude: 25.4360, longitude: -80.3313, coordinateCertainty: 10, sizeFactor: 5.0, geoFactor: 1.4, typeWeight: 1.5, industryFactor: 1.5, valuationConfidence: 90, dataSource: "NextEra 2024 10-K" },
      { facilityName: "St. Lucie Nuclear Plant", assetType: "Power Plant", city: "Jensen Beach", country: "United States", latitude: 27.3486, longitude: -80.2462, coordinateCertainty: 10, sizeFactor: 5.0, geoFactor: 1.3, typeWeight: 1.5, industryFactor: 1.5, valuationConfidence: 90, dataSource: "NextEra 2024 10-K" },
      { facilityName: "Seabrook Nuclear Station", assetType: "Power Plant", city: "Seabrook", country: "United States", latitude: 42.8984, longitude: -70.8476, coordinateCertainty: 10, sizeFactor: 4.5, geoFactor: 1.5, typeWeight: 1.5, industryFactor: 1.5, valuationConfidence: 85, dataSource: "NextEra 2024 10-K" },
      { facilityName: "Wind Farm Portfolio - Texas", assetType: "Power Plant", city: "Abilene", country: "United States", latitude: 32.4487, longitude: -99.7331, coordinateCertainty: 7, sizeFactor: 4.0, geoFactor: 0.9, typeWeight: 1.5, industryFactor: 1.5, valuationConfidence: 80, dataSource: "NextEra 2024 10-K" },
      { facilityName: "Solar Farm Portfolio - California", assetType: "Power Plant", city: "Desert Center", country: "United States", latitude: 33.7105, longitude: -115.3965, coordinateCertainty: 7, sizeFactor: 3.5, geoFactor: 1.5, typeWeight: 1.5, industryFactor: 1.5, valuationConfidence: 80, dataSource: "NextEra 2024 10-K" },
    ],
  };

  for (const company of SEED_COMPANIES) {
    const facilities = companyFacilities[company.name];
    if (!facilities) continue;

    const rawScores = facilities.map((f) => {
      return (
        0.5 * (f.sizeFactor || 1) +
        0.3 * (f.typeWeight || 1) +
        0.2 * (f.geoFactor || 1) +
        0.1 * (f.industryFactor || 1)
      );
    });

    const rawSum = rawScores.reduce((a, b) => a + b, 0);
    const normFactor = (company.totalAssets || 0) / rawSum;

    facilities.forEach((f, i) => {
      allAssets.push({
        companyName: company.name,
        isin: company.isin,
        sector: company.sector,
        facilityName: f.facilityName!,
        address: f.address || null,
        city: f.city || null,
        country: f.country || null,
        latitude: f.latitude || null,
        longitude: f.longitude || null,
        coordinateCertainty: f.coordinateCertainty || null,
        assetType: f.assetType || null,
        valueUsd: rawScores[i] * normFactor,
        sizeFactor: f.sizeFactor || null,
        geoFactor: f.geoFactor || null,
        typeWeight: f.typeWeight || null,
        industryFactor: f.industryFactor || null,
        valuationConfidence: f.valuationConfidence || null,
        dataSource: f.dataSource || null,
      });
    });
  }

  return allAssets;
}

export async function seedDatabase() {
  const existingCount = await storage.getAssetCount();
  if (existingCount > 0) {
    console.log(`Database already has ${existingCount} assets, skipping seed.`);
    return;
  }

  console.log("Seeding database with corporate asset data...");

  for (const company of SEED_COMPANIES) {
    await storage.upsertCompany(company);
  }
  console.log(`Seeded ${SEED_COMPANIES.length} companies.`);

  const allAssets = generateAssets();
  await storage.bulkCreateAssets(allAssets);
  console.log(`Seeded ${allAssets.length} assets.`);

  for (const company of SEED_COMPANIES) {
    const count = allAssets.filter((a) => a.companyName === company.name).length;
    await storage.upsertCompany({ ...company, assetCount: count });
  }
  console.log("Updated company asset counts.");
}
