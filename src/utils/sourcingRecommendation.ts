import type { Cr49f_purchaserequestlines } from "../generated/models/Cr49f_purchaserequestlinesModel";
import type { Cr49f_purchaserequests } from "../generated/models/Cr49f_purchaserequestsModel";
import type { Cr49f_supplierproducts } from "../generated/models/Cr49f_supplierproductsModel";
import type { Cr49f_suppliers } from "../generated/models/Cr49f_suppliersModel";
import type { Cr49f_rfqresponselines } from "../generated/models/Cr49f_rfqresponselinesModel";
import type { Cr49f_rfqsupplierresponses } from "../generated/models/Cr49f_rfqsupplierresponsesModel";
import type { KpiSourcingDetails } from "../types/dashboard";

/**
 * Normalizes GUID strings by removing curly braces, spaces, and lowercasing.
 */
export function cleanGuid(id?: string | null): string {
  if (!id) return "";
  return id.replace(/[{}]/g, "").toLowerCase().trim();
}

/**
 * Normalizes product/item names for reliable matching.
 */
export function normalizeProductName(name?: string | null): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Parses numeric price from string or number, removing currency symbols.
 */
export function parsePrice(price?: string | number | null): number {
  if (typeof price === "number") return isNaN(price) ? 0 : price;
  if (!price) return 0;
  const cleaned = price.replace(/[^0-9.]/g, "");
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

export interface SourcingProductDemand {
  productName: string;
  category?: string;
  totalQuantity: number;
  lastMonthQty: number;
  prevMonthQty: number;
  currentMonthQty: number;
  growthPct: number;
  isIncreasing: boolean;
  trendLabel: string;
}

export interface SupplierMatchInfo {
  supplierId: string;
  supplierName: string;
  supplierCode?: string;
  productName: string;
  catalogPrice: number;
  warranty?: string;
  isAvailable: boolean;
  historicalAvgQuote: number | null;
  historicalQuoteCount: number;
  score: number;
}

export interface SourcingRecommendationResult {
  summaryText: string;
  recommendationAction: string;
  insightTrend: "positive" | "attention";
  details: KpiSourcingDetails | null;
}

/**
 * Groups Purchase Request Lines by product and calendar months to identify
 * products with increasing demand.
 */
export function analyzeProductDemand(
  prLines: Cr49f_purchaserequestlines[],
  prs: Cr49f_purchaserequests[]
): SourcingProductDemand[] {
  if (!prLines || prLines.length === 0) return [];

  // Map PR header creation dates by clean PR ID
  const prDateMap = new Map<string, Date>();
  for (const pr of prs) {
    const rawDate = pr.createdon || pr.overriddencreatedon;
    if (!rawDate) continue;
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      prDateMap.set(cleanGuid(pr.cr49f_purchaserequestid), d);
    }
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Completed month 1 (last month) and month 2 (2 months ago)
  const m1Date = new Date(currentYear, currentMonth - 1, 1);
  const m1Year = m1Date.getFullYear();
  const m1Month = m1Date.getMonth();

  const m2Date = new Date(currentYear, currentMonth - 2, 1);
  const m2Year = m2Date.getFullYear();
  const m2Month = m2Date.getMonth();

  // Aggregate lines by normalized product name
  interface AggProduct {
    canonicalName: string;
    category?: string;
    totalQty: number;
    m1Qty: number;
    m2Qty: number;
    currentQty: number;
  }
  const productsMap = new Map<string, AggProduct>();

  for (const line of prLines) {
    if (line.statecode === 1) continue; // skip inactive lines
    const rawName = line.cr49f_itemname?.trim() || line.cr49f_itemdescription?.trim();
    if (!rawName) continue;

    const normKey = normalizeProductName(rawName);
    if (!normKey) continue;

    // Resolve date: Parent PR creation date first, then line creation date
    let lineDate: Date | undefined;
    const parentPrId = cleanGuid(line._cr49f_purchaserequest_value);
    if (parentPrId && prDateMap.has(parentPrId)) {
      lineDate = prDateMap.get(parentPrId);
    } else {
      const rawLineDate = line.createdon || line.overriddencreatedon;
      if (rawLineDate) {
        const d = new Date(rawLineDate);
        if (!isNaN(d.getTime())) lineDate = d;
      }
    }

    const qty = Number(line.cr49f_quantity) || 1;

    let existing = productsMap.get(normKey);
    if (!existing) {
      existing = {
        canonicalName: rawName,
        category: line.cr49f_category,
        totalQty: 0,
        m1Qty: 0,
        m2Qty: 0,
        currentQty: 0,
      };
      productsMap.set(normKey, existing);
    }

    existing.totalQty += qty;

    if (lineDate) {
      const y = lineDate.getFullYear();
      const m = lineDate.getMonth();
      if (y === m1Year && m === m1Month) {
        existing.m1Qty += qty;
      } else if (y === m2Year && m === m2Month) {
        existing.m2Qty += qty;
      } else if (y === currentYear && m === currentMonth) {
        existing.currentQty += qty;
      }
    } else {
      // If no valid date, treat as ongoing/current period
      existing.currentQty += qty;
    }
  }

  const result: SourcingProductDemand[] = [];

  for (const [, agg] of productsMap.entries()) {
    let growthPct = 0;
    let isIncreasing = false;
    let trendLabel = "0%";

    if (agg.m2Qty > 0) {
      growthPct = Math.round(((agg.m1Qty - agg.m2Qty) / agg.m2Qty) * 100);
      isIncreasing = growthPct > 0;
      trendLabel = `${growthPct >= 0 ? "+" : ""}${growthPct}% MoM`;
    } else if (agg.m1Qty > 0) {
      growthPct = 100;
      isIncreasing = true;
      trendLabel = "+100% MoM";
    } else if (agg.currentQty > 0) {
      // Completed months have 0, but current month shows strong active demand
      growthPct = 50;
      isIncreasing = agg.currentQty >= 1;
      trendLabel = `Active (${agg.currentQty} requested)`;
    }

    result.push({
      productName: agg.canonicalName,
      category: agg.category,
      totalQuantity: agg.totalQty,
      lastMonthQty: agg.m1Qty,
      prevMonthQty: agg.m2Qty,
      currentMonthQty: agg.currentQty,
      growthPct,
      isIncreasing,
      trendLabel,
    });
  }

  // Sort: increasing products first, then by growthPct and totalQuantity descending
  return result.sort((a, b) => {
    if (a.isIncreasing !== b.isIncreasing) return a.isIncreasing ? -1 : 1;
    if (b.growthPct !== a.growthPct) return b.growthPct - a.growthPct;
    return b.totalQuantity - a.totalQuantity;
  });
}

/**
 * Matches surging demand products with active, available suppliers from the
 * supplier catalog, and incorporates historical quotation metrics.
 */
export function matchSuppliersWithQuotations(
  surgingProducts: SourcingProductDemand[],
  supplierProducts: Cr49f_supplierproducts[],
  suppliers: Cr49f_suppliers[],
  rfqResponses: Cr49f_rfqsupplierresponses[],
  rfqLines: Cr49f_rfqresponselines[]
): SupplierMatchInfo[] {
  if (surgingProducts.length === 0 || supplierProducts.length === 0 || suppliers.length === 0) {
    return [];
  }

  // 1. Build map of active, approved suppliers
  const supplierMap = new Map<string, Cr49f_suppliers>();
  for (const s of suppliers) {
    if (s.statecode === 1) continue; // inactive
    // Accept active suppliers (cr49f_supplierstatus === 0 or undefined)
    const supId = cleanGuid(s.cr49f_supplierid);
    if (supId) supplierMap.set(supId, s);
  }

  // 2. Map RFQ response lines to parent supplier
  // cr49f_rfqresponselines -> cr49f_rfqsupplierresponses (_cr49f_supplier_value)
  const responseSupplierMap = new Map<string, string>();
  for (const resp of rfqResponses) {
    const respId = cleanGuid(resp.cr49f_rfqsupplierresponseid);
    const supId = cleanGuid(resp._cr49f_supplier_value);
    if (respId && supId) {
      responseSupplierMap.set(respId, supId);
    }
  }

  // Group quotes by (cleanSupplierId + ':::' + normProductName)
  interface QuoteAgg {
    unitPrices: number[];
    count: number;
  }
  const quotesMap = new Map<string, QuoteAgg>();

  for (const line of rfqLines) {
    if (line.statecode === 1) continue;
    const respId = cleanGuid(line._cr49f_rfqsupplierresponse_value);
    const supId = responseSupplierMap.get(respId);
    if (!supId) continue;

    const lineText = `${line.cr49f_responselineid || ""} ${line.cr49f_additionalchargesdetails || ""}`;
    const normLine = normalizeProductName(lineText);
    const price = Number(line.cr49f_unitprice) || 0;
    if (price <= 0) continue;

    for (const prod of surgingProducts) {
      const normProd = normalizeProductName(prod.productName);
      if (normLine.includes(normProd) || normProd.includes(normLine)) {
        const key = `${supId}:::${normProd}`;
        const existing = quotesMap.get(key) || { unitPrices: [], count: 0 };
        existing.unitPrices.push(price);
        existing.count++;
        quotesMap.set(key, existing);
      }
    }
  }

  const matches: SupplierMatchInfo[] = [];
  const seenSupplierProductPairs = new Set<string>();

  for (const prod of surgingProducts) {
    const normProd = normalizeProductName(prod.productName);

    for (const sp of supplierProducts) {
      if (sp.statecode === 1) continue;
      // Requirement 3: Only recommend suppliers whose products are marked Available (cr49f_availability === 1)
      if (sp.cr49f_availability !== 1) continue;

      const spName = sp.cr49f_productname || sp.cr49f_supplierproductnumber || "";
      const normSp = normalizeProductName(spName);
      if (!normSp) continue;

      // Check product match (exact or substring)
      const isMatch = normSp === normProd || normSp.includes(normProd) || normProd.includes(normSp);
      if (!isMatch) continue;

      const supId = cleanGuid(sp._cr49f_supplier_value);
      if (!supId) continue;

      const supplier = supplierMap.get(supId);
      if (!supplier) continue;

      const pairKey = `${supId}:::${normProd}`;
      if (seenSupplierProductPairs.has(pairKey)) continue;
      seenSupplierProductPairs.add(pairKey);

      const catalogPrice = parsePrice(sp.cr49f_unitprice);
      const quoteData = quotesMap.get(pairKey);

      let historicalAvgQuote: number | null = null;
      let quoteCount = 0;
      if (quoteData && quoteData.unitPrices.length > 0) {
        quoteCount = quoteData.count;
        const sum = quoteData.unitPrices.reduce((a, b) => a + b, 0);
        historicalAvgQuote = Math.round((sum / quoteData.unitPrices.length) * 100) / 100;
      }

      // Transparent ranking heuristic:
      // - Baseline availability bonus: 100
      // - Demand surge bonus: up to 50 pts
      // - Historical quotation track record: +20 pts
      // - Price factor: lower price yields higher rank
      let score = 100 + Math.min(prod.growthPct, 50);
      if (quoteCount > 0) score += 20;

      const effectivePrice = historicalAvgQuote ?? catalogPrice;
      if (effectivePrice > 0) {
        // Subtle preference for lower price benchmark
        score += Math.max(0, 30 - Math.min(25, effectivePrice / 100));
      }

      matches.push({
        supplierId: supId,
        supplierName: supplier.cr49f_name || "Verified Supplier",
        supplierCode: supplier.cr49f_supplierid1,
        productName: prod.productName,
        catalogPrice,
        warranty: sp.cr49f_warranty,
        isAvailable: true,
        historicalAvgQuote,
        historicalQuoteCount: quoteCount,
        score,
      });
    }
  }

  // Sort descending by heuristic score
  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Generates the full dynamic AI Sourcing Recommendation for the RFQ KPI card tooltip.
 */
export function calculateSourcingRecommendation(
  prLines: Cr49f_purchaserequestlines[],
  prs: Cr49f_purchaserequests[],
  supplierProducts: Cr49f_supplierproducts[],
  suppliers: Cr49f_suppliers[],
  rfqResponses: Cr49f_rfqsupplierresponses[],
  rfqLines: Cr49f_rfqresponselines[],
  isLoading: boolean,
  hasError: boolean
): SourcingRecommendationResult {
  // Edge Case: Loading state
  if (isLoading) {
    return {
      summaryText: "Analyzing product demand trends and matching available suppliers from Dataverse...",
      recommendationAction: "Scanning PR lines and supplier catalog availability.",
      insightTrend: "positive",
      details: null,
    };
  }

  // Edge Case: Error state
  if (hasError) {
    return {
      summaryText: "Dataverse sourcing records temporarily unavailable. Showing baseline quotation insight.",
      recommendationAction: "Check Dataverse network connectivity to refresh recommendations.",
      insightTrend: "attention",
      details: null,
    };
  }

  // Edge Case: No PR Lines
  if (!prLines || prLines.length === 0) {
    return {
      summaryText: "No purchase request line items found in Dataverse to evaluate future product demand.",
      recommendationAction: "Create purchase requests to start tracking sourcing demand.",
      insightTrend: "attention",
      details: {
        surgingCount: 0,
        availableSuppliersCount: 0,
        surgingProductsText: "None (0 PR lines)",
        topSuppliersText: "N/A",
        priceBenchmarkText: "Pricing data unavailable",
        rationaleText: "Awaiting PR line records to identify trending products.",
        recommendationAction: "Create purchase requests to initiate sourcing demand tracking.",
      },
    };
  }

  // 1. Analyze product demand
  const demandList = analyzeProductDemand(prLines, prs);
  const surgingProducts = demandList.filter((p) => p.isIncreasing);

  // Edge Case: No products with increasing demand
  if (surgingProducts.length === 0) {
    const topRequested = demandList.slice(0, 2).map((p) => p.productName).join(", ") || "Active items";
    return {
      summaryText: "Demand across requested products is currently stable or insufficient historical months exist to confirm an upward surge.",
      recommendationAction: "Continue monitoring PR volume across upcoming months before issuing new RFQs.",
      insightTrend: "positive",
      details: {
        surgingCount: 0,
        availableSuppliersCount: 0,
        surgingProductsText: `Stable demand (${topRequested})`,
        topSuppliersText: "Catalog active",
        priceBenchmarkText: "Baseline pricing steady",
        rationaleText: "No products currently exhibit month-over-month demand increases.",
        recommendationAction: "Continue monitoring PR volume across upcoming months.",
      },
    };
  }

  // 2. Match with available suppliers
  const matchedSuppliers = matchSuppliersWithQuotations(
    surgingProducts,
    supplierProducts,
    suppliers,
    rfqResponses,
    rfqLines
  );

  const uniqueAvailableSuppliers = Array.from(new Set(matchedSuppliers.map((m) => m.supplierId)));

  // Edge Case: Surging products exist, but no suppliers offer them as Available
  if (matchedSuppliers.length === 0) {
    const surgingNames = surgingProducts.slice(0, 2).map((p) => `${p.productName} (${p.trendLabel})`).join(", ");
    return {
      summaryText: `Surging demand detected for ${surgingNames}, but no active suppliers are currently marked Available in the supplier catalog.`,
      recommendationAction: "Onboard new suppliers or update product availability before initiating RFQs.",
      insightTrend: "attention",
      details: {
        surgingCount: surgingProducts.length,
        availableSuppliersCount: 0,
        surgingProductsText: surgingNames,
        topSuppliersText: "0 available suppliers in catalog",
        priceBenchmarkText: "No active supplier pricing available",
        rationaleText: "Products have increasing demand but lack available catalog suppliers.",
        recommendationAction: "Onboard or update supplier catalog availability.",
      },
    };
  }

  // 3. Prepare display lists
  const surgingNamesList = surgingProducts
    .slice(0, 2)
    .map((p) => `${p.productName} (${p.trendLabel})`)
    .join(", ");

  const topSuppliersList = Array.from(
    new Set(matchedSuppliers.slice(0, 3).map((m) => m.supplierName))
  ).join(", ");

  // Price benchmark calculation
  const quotesWithPrices = matchedSuppliers.filter((m) => m.historicalAvgQuote !== null);
  let priceBenchmarkText = "";
  if (quotesWithPrices.length > 0) {
    const avgHistorical = Math.round(
      quotesWithPrices.reduce((sum, m) => sum + (m.historicalAvgQuote || 0), 0) / quotesWithPrices.length
    );
    priceBenchmarkText = `Avg Quote: $${avgHistorical.toLocaleString()} (${quotesWithPrices.length} historical quotes)`;
  } else {
    const catalogPrices = matchedSuppliers.filter((m) => m.catalogPrice > 0);
    if (catalogPrices.length > 0) {
      const minCatalog = Math.min(...catalogPrices.map((m) => m.catalogPrice));
      priceBenchmarkText = `Catalog: $${minCatalog.toLocaleString()} (Historical quotes unavailable)`;
    } else {
      priceBenchmarkText = "Historical quotes and catalog pricing unavailable";
    }
  }

  const topProduct = surgingProducts[0];
  const rationaleText = `${topProduct.productName} demand grew ${topProduct.trendLabel}; matched suppliers offer confirmed catalog availability.`;

  const sCount = surgingProducts.length;
  const supCount = uniqueAvailableSuppliers.length;

  return {
    summaryText: `${sCount} product${sCount > 1 ? "s" : ""} with increasing purchase request demand ${sCount > 1 ? "have" : "has"} ${supCount} matching supplier${supCount > 1 ? "s" : ""} available in the catalog.`,
    recommendationAction: "Shortlist suitable suppliers before creating upcoming RFQs.",
    insightTrend: "positive",
    details: {
      surgingCount: sCount,
      availableSuppliersCount: supCount,
      surgingProductsText: surgingNamesList,
      topSuppliersText: topSuppliersList,
      priceBenchmarkText,
      rationaleText,
      recommendationAction: "Shortlist suitable suppliers before creating upcoming RFQs.",
    },
  };
}

