import type { Cr49f_purchaserequests } from "../generated/models/Cr49f_purchaserequestsModel";
import type { Cr49f_requestforqoutations } from "../generated/models/Cr49f_requestforqoutationsModel";
import type { Cr49f_rfqsupplierresponses } from "../generated/models/Cr49f_rfqsupplierresponsesModel";
import type { Cr49f_supplierproducts } from "../generated/models/Cr49f_supplierproductsModel";
import type { Cr49f_approvaltaskses } from "../generated/models/Cr49f_approvaltasksesModel";

export function cleanGuid(id?: string | null): string {
  if (!id) return "";
  return id.replace(/[{}]/g, "").toLowerCase().trim();
}

export type HealthStatusLevel = "Healthy" | "Stable with Watch Items" | "Needs Attention" | "Critical" | "Unavailable";
export type HealthStatusTone = "positive" | "stable" | "attention" | "critical";

export interface MetricProgress {
  pct: number | null;
  count: number;
  total: number;
  statusLabel: string;
  tone: "positive" | "attention" | "critical" | "neutral";
}

export interface ProcurementHealthResult {
  healthScore: number | null;
  statusLevel: HealthStatusLevel;
  statusTone: HealthStatusTone;
  statusSummary: string;
  prApproval: MetricProgress;
  rfqCoverage: MetricProgress;
  supplierAvailability: MetricProgress;
  openTasks: {
    count: number;
    total: number;
    statusLabel: string;
    tone: "positive" | "attention" | "critical";
  };
  weightsUsed: {
    pr: number;
    rfq: number;
    supplier: number;
  };
  calculationBreakdown: {
    prContribution: number;
    rfqContribution: number;
    supplierContribution: number;
    totalScore: number;
    weightsNote: string;
  };
}

/**
 * 1. PR Approval Progress
 * PR Approval Progress = (Approved PR Count / Total Eligible PR Count) * 100
 * cr49f_status: 1 is Approved. 0 (Pending), 2 (ChangesNeeded), 3 (Rejected) are non-approved.
 */
export function calculatePRApprovalProgress(prs: Cr49f_purchaserequests[]): MetricProgress {
  if (!prs || prs.length === 0) {
    return {
      pct: null,
      count: 0,
      total: 0,
      statusLabel: "No PR records",
      tone: "neutral",
    };
  }

  const eligiblePRs = prs.filter((p) => p.statecode === 0 || p.statecode === undefined);
  if (eligiblePRs.length === 0) {
    return {
      pct: null,
      count: 0,
      total: 0,
      statusLabel: "0 active PRs",
      tone: "neutral",
    };
  }

  // cr49f_status === 1 indicates Approved
  const approvedCount = eligiblePRs.filter((p) => Number(p.cr49f_status) === 1).length;
  const pct = Math.round((approvedCount / eligiblePRs.length) * 100);

  let tone: "positive" | "attention" | "critical" = "positive";
  let statusLabel = `${pct}% approved (${approvedCount}/${eligiblePRs.length})`;

  if (pct >= 75) {
    tone = "positive";
  } else if (pct >= 50) {
    tone = "attention";
  } else {
    tone = "critical";
  }

  return {
    pct,
    count: approvedCount,
    total: eligiblePRs.length,
    statusLabel,
    tone,
  };
}

/**
 * 2. RFQ Response Coverage
 * RFQ Response Coverage = (RFQs with at least one supplier response / Total Eligible RFQs) * 100
 * Uses _cr49f_rfq_value from cr49f_rfqsupplierresponses.
 */
export function calculateRFQResponseCoverage(
  rfqs: Cr49f_requestforqoutations[],
  responses: Cr49f_rfqsupplierresponses[]
): MetricProgress {
  if (!rfqs || rfqs.length === 0) {
    return {
      pct: null,
      count: 0,
      total: 0,
      statusLabel: "No RFQ records",
      tone: "neutral",
    };
  }

  const eligibleRFQs = rfqs.filter((r) => r.statecode === 0 || r.statecode === undefined);
  if (eligibleRFQs.length === 0) {
    return {
      pct: null,
      count: 0,
      total: 0,
      statusLabel: "0 active RFQs",
      tone: "neutral",
    };
  }

  // Set of RFQ IDs that have received at least one supplier response
  const respondedRfqIds = new Set<string>();
  if (responses && responses.length > 0) {
    for (const resp of responses) {
      if (resp.statecode === 1) continue; // ignore inactive responses
      const rfqId = cleanGuid(resp._cr49f_rfq_value);
      if (rfqId) {
        respondedRfqIds.add(rfqId);
      }
    }
  }

  // Count each RFQ only once
  let coveredCount = 0;
  for (const rfq of eligibleRFQs) {
    const id = cleanGuid(rfq.cr49f_requestforqoutationid);
    if (id && respondedRfqIds.has(id)) {
      coveredCount++;
    }
  }

  const pct = Math.round((coveredCount / eligibleRFQs.length) * 100);

  let tone: "positive" | "attention" | "critical" = "positive";
  if (pct >= 70) {
    tone = "positive";
  } else if (pct >= 40) {
    tone = "attention";
  } else {
    tone = "critical";
  }

  return {
    pct,
    count: coveredCount,
    total: eligibleRFQs.length,
    statusLabel: `${pct}% responded (${coveredCount}/${eligibleRFQs.length})`,
    tone,
  };
}

/**
 * 3. Supplier Availability
 * Supplier Availability = (Available Supplier Products / Total Eligible Supplier Products) * 100
 * cr49f_availability: 1 is Available, 2 is Not Available.
 */
export function calculateSupplierAvailability(
  supplierProducts: Cr49f_supplierproducts[]
): MetricProgress {
  if (!supplierProducts || supplierProducts.length === 0) {
    return {
      pct: null,
      count: 0,
      total: 0,
      statusLabel: "No catalog items",
      tone: "neutral",
    };
  }

  const eligibleProducts = supplierProducts.filter(
    (p) => p.statecode === 0 || p.statecode === undefined
  );
  if (eligibleProducts.length === 0) {
    return {
      pct: null,
      count: 0,
      total: 0,
      statusLabel: "0 active items",
      tone: "neutral",
    };
  }

  // cr49f_availability: 1 = Available
  const availableCount = eligibleProducts.filter(
    (p) => Number(p.cr49f_availability) === 1
  ).length;

  const pct = Math.round((availableCount / eligibleProducts.length) * 100);

  let tone: "positive" | "attention" | "critical" = "positive";
  if (pct >= 80) {
    tone = "positive";
  } else if (pct >= 60) {
    tone = "attention";
  } else {
    tone = "critical";
  }

  return {
    pct,
    count: availableCount,
    total: eligibleProducts.length,
    statusLabel: `${pct}% in stock (${availableCount}/${eligibleProducts.length})`,
    tone,
  };
}

/**
 * 4. Open Procurement Tasks
 * Tasks from cr49f_approvaltaskses where statecode === 0 and approvalstatus is pending (1) or changes needed (4).
 */
export function calculateOpenProcurementTasks(tasks: Cr49f_approvaltaskses[]): {
  count: number;
  total: number;
  statusLabel: string;
  tone: "positive" | "attention" | "critical";
} {
  if (!tasks || tasks.length === 0) {
    return {
      count: 0,
      total: 0,
      statusLabel: "0 pending tasks",
      tone: "positive",
    };
  }

  const activeTasks = tasks.filter((t) => t.statecode === 0 || t.statecode === undefined);

  // Status: 1 = Pending, 4 = ChangesNeeded (both require approver/user action)
  // 2 = Approved, 3 = Rejected (terminal)
  const openTasks = activeTasks.filter((t) => {
    const st = Number(t.cr49f_approvalstatus);
    return st === 1 || st === 4 || isNaN(st) || t.cr49f_approvalstatus === undefined;
  });

  const count = openTasks.length;
  let tone: "positive" | "attention" | "critical" = "positive";

  if (count === 0) {
    tone = "positive";
  } else if (count <= 5) {
    tone = "attention";
  } else {
    tone = "critical";
  }

  return {
    count,
    total: activeTasks.length,
    statusLabel: count === 1 ? "1 task pending" : `${count} tasks pending`,
    tone,
  };
}

/**
 * Configurable business rules for Health Status levels
 */
export function getHealthStatusLevel(score: number): {
  level: HealthStatusLevel;
  tone: HealthStatusTone;
  summary: string;
} {
  if (score >= 85) {
    return {
      level: "Healthy",
      tone: "positive",
      summary: "Procurement pipeline is operating smoothly with optimal approval velocity and supplier responsiveness.",
    };
  }
  if (score >= 70) {
    return {
      level: "Stable with Watch Items",
      tone: "stable",
      summary: "Pipeline is stable overall; monitor open tasks and pending supplier RFQ quotes.",
    };
  }
  if (score >= 50) {
    return {
      level: "Needs Attention",
      tone: "attention",
      summary: "Approvals or RFQ responses are bottlenecked; action is recommended to maintain schedule.",
    };
  }
  return {
    level: "Critical",
    tone: "critical",
    summary: "Critical procurement delays detected across approvals, quotations, or catalog availability.",
  };
}

/**
 * Calculates the comprehensive Procurement Health score and breakdown.
 * Formula: (PR Approval Progress * 0.35) + (RFQ Response Coverage * 0.35) + (Supplier Availability * 0.30)
 * Adjusted-weight approach used if any component is unavailable due to missing records.
 */
export function calculateProcurementHealth(
  prs: Cr49f_purchaserequests[],
  rfqs: Cr49f_requestforqoutations[],
  responses: Cr49f_rfqsupplierresponses[],
  supplierProducts: Cr49f_supplierproducts[],
  approvalTasks: Cr49f_approvaltaskses[]
): ProcurementHealthResult {
  const prProgress = calculatePRApprovalProgress(prs);
  const rfqCoverage = calculateRFQResponseCoverage(rfqs, responses);
  const supplierAvail = calculateSupplierAvailability(supplierProducts);
  const openTasks = calculateOpenProcurementTasks(approvalTasks);

  // Check which metrics have valid data
  const hasPR = prProgress.pct !== null;
  const hasRFQ = rfqCoverage.pct !== null;
  const hasSupplier = supplierAvail.pct !== null;

  let baseWeightPR = 0.35;
  let baseWeightRFQ = 0.35;
  let baseWeightSupplier = 0.30;

  let activeWeightSum = 0;
  if (hasPR) activeWeightSum += baseWeightPR;
  if (hasRFQ) activeWeightSum += baseWeightRFQ;
  if (hasSupplier) activeWeightSum += baseWeightSupplier;

  if (activeWeightSum === 0) {
    return {
      healthScore: null,
      statusLevel: "Unavailable",
      statusTone: "stable",
      statusSummary: "Awaiting Dataverse records to calculate procurement health index.",
      prApproval: prProgress,
      rfqCoverage,
      supplierAvailability: supplierAvail,
      openTasks,
      weightsUsed: { pr: 0, rfq: 0, supplier: 0 },
      calculationBreakdown: {
        prContribution: 0,
        rfqContribution: 0,
        supplierContribution: 0,
        totalScore: 0,
        weightsNote: "No data available in Dataverse tables.",
      },
    };
  }

  // Adjusted weights if any component is missing
  const normPR = hasPR ? baseWeightPR / activeWeightSum : 0;
  const normRFQ = hasRFQ ? baseWeightRFQ / activeWeightSum : 0;
  const normSupplier = hasSupplier ? baseWeightSupplier / activeWeightSum : 0;

  const prContrib = (prProgress.pct ?? 0) * normPR;
  const rfqContrib = (rfqCoverage.pct ?? 0) * normRFQ;
  const supContrib = (supplierAvail.pct ?? 0) * normSupplier;

  const rawScore = prContrib + rfqContrib + supContrib;
  const finalScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  const statusInfo = getHealthStatusLevel(finalScore);

  let weightsNote = "35% PR Approval + 35% RFQ Coverage + 30% Supplier Availability";
  if (activeWeightSum < 1) {
    weightsNote = `Adjusted weights (${Math.round(normPR * 100)}% PR, ${Math.round(normRFQ * 100)}% RFQ, ${Math.round(normSupplier * 100)}% Supplier) due to unpopulated tables.`;
  }

  return {
    healthScore: finalScore,
    statusLevel: statusInfo.level,
    statusTone: statusInfo.tone,
    statusSummary: statusInfo.summary,
    prApproval: prProgress,
    rfqCoverage,
    supplierAvailability: supplierAvail,
    openTasks,
    weightsUsed: {
      pr: Math.round(normPR * 100),
      rfq: Math.round(normRFQ * 100),
      supplier: Math.round(normSupplier * 100),
    },
    calculationBreakdown: {
      prContribution: Math.round(prContrib * 10) / 10,
      rfqContribution: Math.round(rfqContrib * 10) / 10,
      supplierContribution: Math.round(supContrib * 10) / 10,
      totalScore: finalScore,
      weightsNote,
    },
  };
}

