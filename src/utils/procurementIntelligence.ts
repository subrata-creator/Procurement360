import type { Cr49f_purchaserequests } from "../generated/models/Cr49f_purchaserequestsModel";
import type { Cr49f_purchaserequestlines } from "../generated/models/Cr49f_purchaserequestlinesModel";
import type { Cr49f_requestforqoutations } from "../generated/models/Cr49f_requestforqoutationsModel";
import type { Cr49f_rfqsupplierresponses } from "../generated/models/Cr49f_rfqsupplierresponsesModel";
import {
  PROCUREMENT_BUDGET_REMAINING_USD,
  PROCUREMENT_BUDGET_USD,
} from "../data/procurementBudget";
import { calculateRFQResponseCoverage } from "./procurementHealth";

export type InsightSeverity = "critical" | "warning" | "healthy" | "stable";

export interface ProcessRiskInsight {
  title: string;
  description: string;
  totalActivePRs: number;
  pendingPRs: number;
  agingPendingPRs: number;
  oldestPendingAgeDays: number;
  agingPct: number;
  thresholdDays: number;
  severity: InsightSeverity;
  toneClass: "process" | "critical" | "healthy" | "stable";
  badgeText: string;
  sourceLabel: string;
  ctaText: string;
  isActionRequired: boolean;
}

export interface BudgetWatchInsight {
  title: string;
  description: string;
  allocatedBudget: number;
  committedSpend: number;
  remainingBudget: number;
  utilizationPct: number;
  category: string;
  severity: InsightSeverity;
  toneClass: "budget" | "critical" | "healthy" | "stable";
  badgeText: string;
  sourceLabel: string;
  ctaText: string;
  isActionRequired: boolean;
}

export interface ForecastInsight {
  title: string;
  description: string;
  forecastCount: number | null;
  historyCounts: number[];
  averageMonthlyVolume: number | null;
  hasHistoricalData: boolean;
  responseCoveragePct: number | null;
  severity: InsightSeverity;
  toneClass: "forecast" | "process" | "healthy" | "stable" | "critical";
  badgeText: string;
  sourceLabel: string;
  ctaText: string;
  isActionRequired: boolean;
}

export interface ProcurementIntelligenceResult {
  processRisk: ProcessRiskInsight;
  budgetWatch: BudgetWatchInsight;
  forecast: ForecastInsight;
  activeInsightsCount: number;
  attentionCount: number;
  headerBadgeText: string;
}

/**
 * 1. Process Risk Card — Dynamic Purchase Request Risk
 * Analyzes active PRs and calculates aging backlog awaiting approval for > thresholdDays (default 7).
 */
export function calculateProcessRiskInsight(
  prs: Cr49f_purchaserequests[],
  thresholdDays: number = 7
): ProcessRiskInsight {
  const activePRs = (prs || []).filter(
    (p) => p.statecode === 0 || p.statecode === undefined
  );

  const totalActivePRs = activePRs.length;

  if (totalActivePRs === 0) {
    return {
      title: "No active requests",
      description: "No active purchase request records found in Dataverse.",
      totalActivePRs: 0,
      pendingPRs: 0,
      agingPendingPRs: 0,
      oldestPendingAgeDays: 0,
      agingPct: 0,
      thresholdDays,
      severity: "stable",
      toneClass: "stable",
      badgeText: "PROCESS RISK",
      sourceLabel: "Purchase Requests",
      ctaText: "Review PRs",
      isActionRequired: false,
    };
  }

  // Pending status === 0
  const pendingPRsList = activePRs.filter((p) => Number(p.cr49f_status) === 0);
  const pendingPRs = pendingPRsList.length;

  const now = Date.now();
  const dayMs = 1000 * 60 * 60 * 24;

  const agingPendingList = pendingPRsList.filter((p) => {
    const rawDate = p.createdon || p.overriddencreatedon;
    if (!rawDate) return false;
    const createdTime = new Date(rawDate).getTime();
    if (isNaN(createdTime)) return false;
    const diffDays = Math.floor((now - createdTime) / dayMs);
    return diffDays >= thresholdDays;
  });

  const oldestPendingAgeDays = pendingPRsList.reduce((max, p) => {
    const rawDate = p.createdon || p.overriddencreatedon;
    if (!rawDate) return max;
    const createdTime = new Date(rawDate).getTime();
    if (isNaN(createdTime)) return max;
    const diffDays = Math.floor((now - createdTime) / dayMs);
    return Math.max(max, diffDays >= 0 ? diffDays : 0);
  }, 0);

  const agingPendingPRs = agingPendingList.length;
  const agingPct =
    pendingPRs > 0 ? Math.round((agingPendingPRs / pendingPRs) * 100) : 0;

  if (agingPendingPRs > 0) {
    const isCritical = agingPendingPRs >= 3 || agingPct >= 50;
    const countLabel = `${agingPendingPRs} purchase request${agingPendingPRs === 1 ? "" : "s"}`;
    return {
      title: isCritical ? "Approval backlog bottleneck" : "Aging purchase requests",
      description: `${countLabel} are awaiting approval for more than ${thresholdDays} days.`,
      totalActivePRs,
      pendingPRs,
      agingPendingPRs,
      oldestPendingAgeDays,
      agingPct,
      thresholdDays,
      severity: isCritical ? "critical" : "warning",
      toneClass: isCritical ? "critical" : "process",
      badgeText: "PROCESS RISK",
      sourceLabel: "Purchase Requests",
      ctaText: "Review PRs",
      isActionRequired: true,
    };
  }

  if (pendingPRs > 0) {
    const countLabel = `${pendingPRs} purchase request${pendingPRs === 1 ? "" : "s"}`;
    return {
      title: "Review queue is active",
      description: `${countLabel} are currently in progress awaiting approvals.`,
      totalActivePRs,
      pendingPRs,
      agingPendingPRs: 0,
      oldestPendingAgeDays,
      agingPct: 0,
      thresholdDays,
      severity: "healthy",
      toneClass: "process",
      badgeText: "PROCESS RISK",
      sourceLabel: "Purchase Requests",
      ctaText: "Review PRs",
      isActionRequired: false,
    };
  }

  return {
    title: "Approval queue is clear",
    description: "Approval queue is clear. All purchase requests have been reviewed.",
    totalActivePRs,
    pendingPRs: 0,
    agingPendingPRs: 0,
    oldestPendingAgeDays: 0,
    agingPct: 0,
    thresholdDays,
    severity: "healthy",
    toneClass: "healthy",
    badgeText: "PROCESS RISK",
    sourceLabel: "Purchase Requests",
    ctaText: "Review PRs",
    isActionRequired: false,
  };
}

/**
 * 2. Budget Watch Card — Dynamic Budget Intelligence
 * Formula: Utilization % = (Actual Committed Spend / Allocated Budget) * 100
 * Dynamically identifies category with highest utilization/spend instead of hardcoding IT.
 */
export function calculateBudgetWatchInsight(
  prs: Cr49f_purchaserequests[],
  prLines: Cr49f_purchaserequestlines[],
  allocatedBudget: number = PROCUREMENT_BUDGET_USD,
  remainingBudget: number = PROCUREMENT_BUDGET_REMAINING_USD
): BudgetWatchInsight {
  if (!allocatedBudget || allocatedBudget <= 0) {
    return {
      title: "Budget allocation unavailable",
      description: "Budget allocation data is unavailable or zero.",
      allocatedBudget: 0,
      committedSpend: 0,
      remainingBudget: 0,
      utilizationPct: 0,
      category: "General Procurement",
      severity: "stable",
      toneClass: "stable",
      badgeText: "BUDGET WATCH",
      sourceLabel: "Allocated Budget KPI",
      ctaText: "Review budget context",
      isActionRequired: false,
    };
  }

  // Group line items by category to discover active categories dynamically
  const categorySpendMap = new Map<string, number>();
  for (const line of prLines || []) {
    if (line.statecode === 1) continue;
    const cat = line.cr49f_category?.trim() || "Information Technology";
    const qty = Number(line.cr49f_quantity) || 1;
    const price = Number(line.cr49f_unitprice) || 0;
    const lineCost = qty * price;
    categorySpendMap.set(cat, (categorySpendMap.get(cat) || 0) + lineCost);
  }

  // Check active PRs
  const activePRs = (prs || []).filter(
    (p) => p.statecode === 0 || p.statecode === undefined
  );
  const prsSpendTotal = activePRs.reduce(
    (sum, p) => sum + (Number(p.cr49f_totalamount) || 0),
    0
  );

  // Baseline committed spend from budget data
  const baselineCommitted = Math.max(0, allocatedBudget - remainingBudget);

  const linesTotal = Array.from(categorySpendMap.values()).reduce(
    (sum, v) => sum + v,
    0
  );

  const actualCommittedSpend = Math.max(
    baselineCommitted,
    prsSpendTotal,
    linesTotal
  );

  const utilizationPct = Math.round(
    (actualCommittedSpend / allocatedBudget) * 100
  );

  // Identify highest category spend
  const sortedCategories = Array.from(categorySpendMap.entries()).sort(
    (a, b) => b[1] - a[1]
  );

  const topCategory =
    sortedCategories.length > 0 && sortedCategories[0][0]
      ? sortedCategories[0][0]
      : "Information Technology";

  let message = "";
  let severity: InsightSeverity = "healthy";
  let toneClass: "budget" | "critical" | "healthy" | "stable" = "healthy";
  let title = "";
  let isActionRequired = false;

  if (utilizationPct >= 100) {
    severity = "critical";
    toneClass = "critical";
    title = `${topCategory} budget exceeded`;
    message = "Budget allocation has been reached or exceeded.";
    isActionRequired = true;
  } else if (utilizationPct >= 90) {
    severity = "critical";
    toneClass = "budget";
    title = `${topCategory} nearing allocation`;
    message = "Budget is nearing its allocation. Prioritize upcoming purchases.";
    isActionRequired = true;
  } else if (utilizationPct >= 75) {
    severity = "warning";
    toneClass = "budget";
    title = `${topCategory} utilization elevated`;
    message = "Budget utilization is elevated. Review planned requests.";
    isActionRequired = true;
  } else if (utilizationPct >= 50) {
    severity = "warning";
    toneClass = "budget";
    title = `${topCategory} utilization increasing`;
    message = "Budget utilization is increasing. Monitor upcoming requests.";
    isActionRequired = false;
  } else {
    severity = "healthy";
    toneClass = "healthy";
    title = `${topCategory} budget is comfortable`;
    message = "Budget utilization is within a comfortable range.";
    isActionRequired = false;
  }

  const description = `${topCategory} is at ${utilizationPct}% of allocation. ${message}`;

  return {
    title,
    description,
    allocatedBudget,
    committedSpend: actualCommittedSpend,
    remainingBudget,
    utilizationPct,
    category: topCategory,
    severity,
    toneClass,
    badgeText: "BUDGET WATCH",
    sourceLabel: "Allocated Budget KPI",
    ctaText: "Review budget context",
    isActionRequired,
  };
}

/**
 * 3. Forecast Card — Dynamic RFQ Forecasting
 * Formula: Next Month Forecast = (Month 1 RFQ Count + Month 2 RFQ Count + Month 3 RFQ Count) / 3
 * Evaluates the last 3 completed calendar months and actual RFQ supplier response coverage.
 */
export function calculateForecastInsight(
  rfqs: Cr49f_requestforqoutations[],
  rfqResponses: Cr49f_rfqsupplierresponses[]
): ForecastInsight {
  const activeRfqs = (rfqs || []).filter(
    (r) => r.statecode === 0 || r.statecode === undefined
  );

  // RFQ Coverage using actual Dataverse responses
  const coverageMetric = calculateRFQResponseCoverage(activeRfqs, rfqResponses || []);
  const coveragePct = coverageMetric.pct;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Identify the last 3 completed calendar months (excluding current month)
  const completedMonths: Array<{ key: string; label: string }> = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "short", year: "numeric" });
    completedMonths.push({ key, label });
  }

  // Count RFQs per month
  const countsByMonth = new Map<string, number>();
  for (const r of activeRfqs) {
    const dateStr = r.createdon || r.overriddencreatedon;
    if (!dateStr) continue;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    countsByMonth.set(key, (countsByMonth.get(key) || 0) + 1);
  }

  const c1 = countsByMonth.get(completedMonths[0].key) || 0;
  const c2 = countsByMonth.get(completedMonths[1].key) || 0;
  const c3 = countsByMonth.get(completedMonths[2].key) || 0;
  const historyCounts = [c3, c2, c1];
  const totalCompleted = c1 + c2 + c3;
  const hasHistoricalData = totalCompleted > 0;

  if (!hasHistoricalData) {
    const coverageText =
      coveragePct !== null
        ? ` Current supplier response coverage is ${coveragePct}%.`
        : "";
    return {
      title: "RFQ volume trend",
      description: `Insufficient historical data to generate an RFQ forecast.${coverageText}`,
      forecastCount: null,
      historyCounts,
      averageMonthlyVolume: null,
      hasHistoricalData: false,
      responseCoveragePct: coveragePct,
      severity: "stable",
      toneClass: "forecast",
      badgeText: "FORECAST",
      sourceLabel: "RFQ Response Coverage",
      ctaText: "Validate RFQ forecast",
      isActionRequired: false,
    };
  }

  const avg = totalCompleted / 3;
  const forecastCount = Math.round(avg);

  const isLowCoverage = coveragePct !== null && coveragePct < 50;
  let description = `RFQ volume is projected to reach ${forecastCount} next month.`;

  if (coveragePct !== null) {
    description += ` Current supplier response coverage is ${coveragePct}%.`;
    if (isLowCoverage) {
      description += " Review supplier response capacity.";
    }
  }

  return {
    title: isLowCoverage ? "RFQ response capacity alert" : "RFQ volume trend",
    description,
    forecastCount,
    historyCounts,
    averageMonthlyVolume: Math.round(avg * 10) / 10,
    hasHistoricalData: true,
    responseCoveragePct: coveragePct,
    severity: isLowCoverage ? "warning" : "healthy",
    toneClass: isLowCoverage ? "process" : "forecast",
    badgeText: "FORECAST",
    sourceLabel: "RFQ Response Coverage",
    ctaText: "View forecast",
    isActionRequired: isLowCoverage,
  };
}

/**
 * Aggregates all 3 Procurement Intelligence cards
 */
export function calculateProcurementIntelligence(
  prs: Cr49f_purchaserequests[],
  prLines: Cr49f_purchaserequestlines[],
  rfqs: Cr49f_requestforqoutations[],
  rfqResponses: Cr49f_rfqsupplierresponses[],
  allocatedBudget: number = PROCUREMENT_BUDGET_USD,
  remainingBudget: number = PROCUREMENT_BUDGET_REMAINING_USD
): ProcurementIntelligenceResult {
  const processRisk = calculateProcessRiskInsight(prs);
  const budgetWatch = calculateBudgetWatchInsight(
    prs,
    prLines,
    allocatedBudget,
    remainingBudget
  );
  const forecast = calculateForecastInsight(rfqs, rfqResponses);

  let attentionCount = 0;
  if (processRisk.isActionRequired) attentionCount++;
  if (budgetWatch.isActionRequired) attentionCount++;
  if (forecast.isActionRequired) attentionCount++;

  const headerBadgeText =
    attentionCount > 0
      ? `${attentionCount} action item${attentionCount === 1 ? "" : "s"}`
      : "3 insights";

  return {
    processRisk,
    budgetWatch,
    forecast,
    activeInsightsCount: 3,
    attentionCount,
    headerBadgeText,
  };
}

/**
 * Structured Metrics Payload for Power Automate AI Flow
 */
export interface FlowMetricsPayload {
  processRisk: {
    pendingPRsOver7Days: number;
    oldestPendingAgeDays: number;
    totalPendingPRs: number;
  };
  budgetWatch: {
    category: string;
    utilizationPercentage: number;
    allocatedBudget: number;
    committedSpend: number;
    remainingBudget: number;
  };
  forecast: {
    forecastedRFQVolume: number | null;
    supplierResponseCoverage: number | null;
    historicalMonthlyRFQCounts: number[];
  };
}

/**
 * Builds the dynamic metrics payload from actual dashboard intelligence values
 */
export function buildFlowMetricsPayload(
  intelligence: ProcurementIntelligenceResult
): FlowMetricsPayload {
  return {
    processRisk: {
      pendingPRsOver7Days: intelligence.processRisk.agingPendingPRs,
      oldestPendingAgeDays: intelligence.processRisk.oldestPendingAgeDays,
      totalPendingPRs: intelligence.processRisk.pendingPRs,
    },
    budgetWatch: {
      category: intelligence.budgetWatch.category,
      utilizationPercentage: intelligence.budgetWatch.utilizationPct,
      allocatedBudget: intelligence.budgetWatch.allocatedBudget,
      committedSpend: intelligence.budgetWatch.committedSpend,
      remainingBudget: intelligence.budgetWatch.remainingBudget,
    },
    forecast: {
      forecastedRFQVolume: intelligence.forecast.forecastCount,
      supplierResponseCoverage: intelligence.forecast.responseCoveragePct,
      historicalMonthlyRFQCounts: intelligence.forecast.historyCounts,
    },
  };
}

/**
 * Expected schema returned by Power Automate Flow inside `aiinsights` string
 */
export interface AiInsightCardOutput {
  title?: string;
  recommendation?: string;
  severity?: "Critical" | "Warning" | "Healthy" | "Stable" | string;
  actionText?: string;
}

export interface AiFlowResponseParsed {
  cards?: AiInsightCardOutput[];
  actionItemsCount?: number;
}

/**
 * Safely parses the AI Builder / Power Automate response JSON string
 */
export function parseAiInsightsResponse(raw?: string): AiFlowResponseParsed | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let jsonString = trimmed;
  // If wrapped in markdown code fence ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    jsonString = fenceMatch[1].trim();
  } else {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonString = trimmed.slice(firstBrace, lastBrace + 1);
    }
  }

  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as AiFlowResponseParsed;
  } catch (err) {
    console.warn(
      "[parseAiInsightsResponse] Failed to parse AI insights JSON string:",
      err,
      "Raw string was:",
      raw
    );
    return null;
  }
}

/**
 * Seamlessly merges LLM-generated recommendations into existing dashboard cards
 * while strictly retaining numerical accuracy and fallback stability
 */
export function applyAiInsightsToResult(
  base: ProcurementIntelligenceResult,
  aiResponse: AiFlowResponseParsed | null
): ProcurementIntelligenceResult {
  if (
    !aiResponse ||
    !Array.isArray(aiResponse.cards) ||
    aiResponse.cards.length === 0
  ) {
    return base;
  }

  const cards = aiResponse.cards;

  const findCard = (
    topicKeyword: string,
    fallbackIdx: number
  ): AiInsightCardOutput | undefined => {
    const match = cards.find((c) =>
      c?.title?.toLowerCase().includes(topicKeyword.toLowerCase())
    );
    return match || cards[fallbackIdx];
  };

  const processAi = findCard("process", 0);
  const budgetAi = findCard("budget", 1);
  const forecastAi = findCard("forecast", 2);

  const normalizeSeverity = (
    sev?: string,
    defaultSev: InsightSeverity = "healthy"
  ): {
    severity: InsightSeverity;
    isCritical: boolean;
    isWarning: boolean;
  } => {
    const s = sev?.trim().toLowerCase();
    if (s === "critical" || s === "high" || s === "danger") {
      return { severity: "critical", isCritical: true, isWarning: false };
    }
    if (s === "warning" || s === "attention" || s === "medium") {
      return { severity: "warning", isCritical: false, isWarning: true };
    }
    if (s === "healthy" || s === "low" || s === "good" || s === "positive") {
      return { severity: "healthy", isCritical: false, isWarning: false };
    }
    return {
      severity: defaultSev,
      isCritical: defaultSev === "critical",
      isWarning: defaultSev === "warning",
    };
  };

  // 1. Process Risk
  const updatedProcessRisk = { ...base.processRisk };
  if (processAi) {
    if (processAi.title?.trim()) {
      updatedProcessRisk.title = processAi.title.trim();
    }
    if (processAi.recommendation?.trim()) {
      updatedProcessRisk.description = processAi.recommendation.trim();
    }
    if (processAi.severity) {
      const norm = normalizeSeverity(
        processAi.severity,
        base.processRisk.severity
      );
      updatedProcessRisk.severity = norm.severity;
      updatedProcessRisk.toneClass = norm.isCritical ? "critical" : norm.isWarning ? "process" : "healthy";
      updatedProcessRisk.isActionRequired =
        norm.isCritical || norm.isWarning;
    }
    if (processAi.actionText?.trim()) {
      updatedProcessRisk.ctaText = processAi.actionText.trim();
    }
  }

  // 2. Budget Watch
  const updatedBudgetWatch = { ...base.budgetWatch };
  if (budgetAi) {
    if (budgetAi.title?.trim()) {
      updatedBudgetWatch.title = budgetAi.title.trim();
    }
    if (budgetAi.recommendation?.trim()) {
      updatedBudgetWatch.description = budgetAi.recommendation.trim();
    }
    if (budgetAi.severity) {
      const norm = normalizeSeverity(
        budgetAi.severity,
        base.budgetWatch.severity
      );
      updatedBudgetWatch.severity = norm.severity;
      updatedBudgetWatch.toneClass = norm.isCritical ? "critical" : norm.isWarning ? "budget" : "healthy";
      updatedBudgetWatch.isActionRequired =
        norm.isCritical || norm.isWarning;
    }
    if (budgetAi.actionText?.trim()) {
      updatedBudgetWatch.ctaText = budgetAi.actionText.trim();
    }
  }

  // 3. Forecast
  const updatedForecast = { ...base.forecast };
  if (forecastAi) {
    if (forecastAi.title?.trim()) {
      updatedForecast.title = forecastAi.title.trim();
    }
    if (forecastAi.recommendation?.trim()) {
      let rec = forecastAi.recommendation.trim();
      // Correct unsupported comparisons where AI compares coverage percentage to historical counts
      if (/unusually high compared to (historical )?rfq/i.test(rec) || /coverage.*compared to.*(count|volume)/i.test(rec)) {
        rec = `RFQ volume is projected at ${base.forecast.forecastCount ?? 1} next month. Supplier response coverage is currently ${base.forecast.responseCoveragePct ?? 0}%, requiring review to improve quote participation across active RFQs.`;
      }
      updatedForecast.description = rec;
    }
    if (forecastAi.severity) {
      const norm = normalizeSeverity(
        forecastAi.severity,
        base.forecast.severity
      );
      updatedForecast.severity = norm.severity;
      updatedForecast.toneClass = norm.isCritical ? "critical" : norm.isWarning ? "process" : "forecast";
      updatedForecast.isActionRequired =
        norm.isCritical || norm.isWarning;
    }
    if (forecastAi.actionText?.trim()) {
      updatedForecast.ctaText = forecastAi.actionText.trim();
    } else {
      updatedForecast.ctaText = "Validate RFQ forecast";
    }
  }

  // 9. Action Items Count
  // Use returned actionItemsCount if available and valid number, otherwise count action-required cards
  const actionItemsCount =
    typeof aiResponse.actionItemsCount === "number" &&
    !isNaN(aiResponse.actionItemsCount)
      ? aiResponse.actionItemsCount
      : [updatedProcessRisk, updatedBudgetWatch, updatedForecast].filter(
          (c) => c.isActionRequired
        ).length;

  const headerBadgeText =
    actionItemsCount > 0
      ? `${actionItemsCount} action item${actionItemsCount === 1 ? "" : "s"}`
      : "3 insights";

  return {
    processRisk: updatedProcessRisk,
    budgetWatch: updatedBudgetWatch,
    forecast: updatedForecast,
    activeInsightsCount: 3,
    attentionCount: actionItemsCount,
    headerBadgeText,
  };
}
