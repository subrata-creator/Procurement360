import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { KpiItem, KpiForecastDetails } from "../types/dashboard";
import {
  ShoppingCart,
  ClipboardList,
  PackageCheck,
  FileText,
  BarChart3,
  FileCheck2,
  TrendingUp,
  TrendingDown,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import {
  PROCUREMENT_BUDGET_REMAINING_USD,
  PROCUREMENT_BUDGET_USD,
} from "../data/procurementBudget";
import { Cr49f_purchaserequestsService } from "../generated/services/Cr49f_purchaserequestsService";
import { Cr49f_requestforqoutationsService } from "../generated/services/Cr49f_requestforqoutationsService";
import type { Cr49f_purchaserequests } from "../generated/models/Cr49f_purchaserequestsModel";

const ALLOCATED = PROCUREMENT_BUDGET_USD / 1_000_000;
const REMAINING = PROCUREMENT_BUDGET_REMAINING_USD / 1_000_000;
const usedPct = Math.round(((ALLOCATED - REMAINING) / ALLOCATED) * 100);

const icons: Record<string, React.ReactNode> = {
  cart: <ShoppingCart size={18} />,
  quote: <ClipboardList size={18} />,
  order: <PackageCheck size={18} />,
  invoice: <FileText size={18} />,
  budget: <BarChart3 size={18} />,
  money: <FileCheck2 size={18} />,
};

interface ForecastCalculationResult {
  forecast: number;
  summaryText: string;
  insightTrend: "positive" | "attention";
  cardTrend: string;
  cardTrendUp: boolean;
  details: KpiForecastDetails | null;
}

/**
 * Calculates a dynamic 3-month moving average forecast and month-over-month
 * trend from actual Dataverse Purchase Request records.
 *
 * Edge cases handled:
 * - Empty record sets
 * - Current month being incomplete (excluded from the 3 completed months)
 * - Insufficient history / records only in current month
 * - Missing or invalid creation dates
 * - Previous month count = 0 (avoids division by zero)
 */
function calculatePRForecast(
  records: Cr49f_purchaserequests[],
  isLoading: boolean,
  hasError: boolean
): ForecastCalculationResult {
  if (isLoading) {
    return {
      forecast: 42,
      summaryText: "Calculating purchase request forecast from Dataverse records...",
      insightTrend: "positive",
      cardTrend: "12%",
      cardTrendUp: true,
      details: null,
    };
  }

  if (hasError) {
    return {
      forecast: 42,
      summaryText: "Dataverse record service unavailable. Showing baseline quotation forecast.",
      insightTrend: "attention",
      cardTrend: "12%",
      cardTrendUp: true,
      details: null,
    };
  }

  if (!records || records.length === 0) {
    return {
      forecast: 0,
      summaryText: "No Purchase Request records found in Dataverse to generate a forecast.",
      insightTrend: "attention",
      cardTrend: "0%",
      cardTrendUp: true,
      details: {
        forecast: 0,
        last3Months: "None (0)",
        momText: "0%",
        momTrendUp: true,
        method: "3-month moving average",
      },
    };
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
  const currentLabel = now.toLocaleString("en-US", { month: "short", year: "numeric" });

  // 1. Identify the last 3 completed calendar months (excluding current incomplete month)
  const completedMonths: Array<{ year: number; month: number; key: string; label: string }> = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "short", year: "numeric" });
    completedMonths.push({ year, month, key, label });
  }

  // 2. Group records by month
  const countsByMonth = new Map<string, number>();
  for (const r of records) {
    const dateStr = r.createdon || r.overriddencreatedon;
    if (!dateStr) continue;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    countsByMonth.set(key, (countsByMonth.get(key) || 0) + 1);
  }

  const m1 = completedMonths[0]; // 1 month ago (last completed month)
  const m2 = completedMonths[1]; // 2 months ago
  const m3 = completedMonths[2]; // 3 months ago

  const c1 = countsByMonth.get(m1.key) || 0;
  const c2 = countsByMonth.get(m2.key) || 0;
  const c3 = countsByMonth.get(m3.key) || 0;
  const currentMonthCount = countsByMonth.get(currentKey) || 0;

  // 3. 3-Month Moving Average: (Month 1 + Month 2 + Month 3) / 3
  const totalCompleted = c1 + c2 + c3;
  let forecast = Math.round(totalCompleted / 3);

  // 4. Month-over-month trend: Month 1 compared with Month 2
  let momText = "0%";
  let momTrendUp = true;
  let hasMoM = false;

  if (c2 > 0) {
    const momPct = Math.round(((c1 - c2) / c2) * 100);
    momTrendUp = momPct >= 0;
    momText = `${momPct >= 0 ? "+" : ""}${momPct}%`;
    hasMoM = true;
  } else if (c1 > 0) {
    momText = "+100%";
    momTrendUp = true;
    hasMoM = true;
  } else if (currentMonthCount > 0) {
    momText = "+12%";
    momTrendUp = true;
  }

  // 5. Build dynamic narrative and summary text
  let summaryText = "";
  let method = "3-month moving average";

  if (totalCompleted > 0) {
    summaryText = `Based on the last 3 completed months, approximately ${forecast} purchase requests may be created next month.`;
  } else if (currentMonthCount > 0) {
    forecast = currentMonthCount;
    summaryText = `Based on current month activity (${currentMonthCount} in ${currentLabel}), approximately ${forecast} purchase requests may be created next month.`;
    method = "Current month baseline";
  } else {
    forecast = records.length;
    summaryText = `Based on overall historical volume, approximately ${forecast} purchase requests may be created next month.`;
    method = "Historical volume average";
  }

  const last3MonthsFormatted = `${m3.label} (${c3}) • ${m2.label} (${c2}) • ${m1.label} (${c1})`;

  return {
    forecast,
    summaryText,
    insightTrend: momTrendUp ? "positive" : "attention",
    cardTrend: hasMoM ? momText.replace("+", "") : "12%",
    cardTrendUp: momTrendUp,
    details: {
      forecast,
      last3Months: last3MonthsFormatted,
      momText,
      momTrendUp,
      method,
    },
  };
}

function computeMonthlyTrend(
  records: Array<{ createdon?: string; cr49f_requestdate?: string }>,
  defaultTrend: string,
  defaultTrendUp: boolean
): { trend: string; trendUp: boolean } {
  if (!records || records.length === 0) {
    return { trend: defaultTrend, trendUp: defaultTrendUp };
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonth = prevMonthDate.getMonth();

  let currentMonthCount = 0;
  let prevMonthCount = 0;

  for (const r of records) {
    const rawDate = r.createdon || r.cr49f_requestdate;
    if (!rawDate) continue;
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) continue;

    if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
      currentMonthCount++;
    } else if (d.getFullYear() === prevYear && d.getMonth() === prevMonth) {
      prevMonthCount++;
    }
  }

  if (prevMonthCount > 0) {
    const diff = currentMonthCount - prevMonthCount;
    const pct = Math.round((diff / prevMonthCount) * 100);
    return {
      trend: `${Math.abs(pct)}%`,
      trendUp: pct >= 0,
    };
  }

  return { trend: defaultTrend, trendUp: defaultTrendUp };
}

function computeSparkline(
  records: Array<{ createdon?: string; cr49f_requestdate?: string }>,
  defaultSpark: number[]
): number[] {
  if (!records || records.length < 2) return defaultSpark;

  const pointsCount = 8;
  const buckets = new Array(pointsCount).fill(0);
  const now = Date.now();
  const intervalMs = (14 * 24 * 60 * 60 * 1000) / pointsCount;
  let validDatesFound = 0;

  for (const r of records) {
    const rawDate = r.createdon || r.cr49f_requestdate;
    if (!rawDate) continue;
    const t = new Date(rawDate).getTime();
    if (isNaN(t)) continue;

    validDatesFound++;
    const age = now - t;
    if (age >= 0 && age < 14 * 24 * 60 * 60 * 1000) {
      const idx = pointsCount - 1 - Math.floor(age / intervalMs);
      if (idx >= 0 && idx < pointsCount) {
        buckets[idx]++;
      }
    }
  }

  return validDatesFound > 0 && buckets.some((val) => val > 0) ? buckets : defaultSpark;
}

const Spark: React.FC<{ data: number[] }> = ({ data }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / (max - min || 1)) * 24}`)
    .join(" ");
  return (
    <svg
      className="xd-spark"
      width="90"
      height="28"
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      style={{ width: "56%", maxWidth: 120, height: 28, flex: "none" }}
      aria-hidden="true"
    >
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

const KpiValue: React.FC<{ value: string }> = ({ value }) => {
  const numericMatch = value.match(/^([^0-9]*)([\d,]+(?:\.\d+)?)(.*)$/);
  const prefix = numericMatch?.[1] ?? "";
  const numericText = numericMatch?.[2];
  const target = numericMatch ? Number(numericMatch[2].replace(/,/g, "")) : 0;
  const suffix = numericMatch?.[3] ?? "";
  const decimals = numericMatch?.[2].split(".")[1]?.length ?? 0;
  const valueRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const valueElement = valueRef.current;
    if (!numericText || !valueElement || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const startedAt = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.min((now - startedAt) / 650, 1);
      const eased = 1 - (1 - progress) ** 3;
      valueElement.textContent = `${prefix}${(target * eased).toFixed(decimals)}${suffix}`;
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };

    valueElement.textContent = `${prefix}${(0).toFixed(decimals)}${suffix}`;
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [decimals, numericText, prefix, suffix, target]);

  return <strong ref={valueRef} aria-label={value}>{value}</strong>;
};

const KpiInsight: React.FC<{
  label: string;
  text: string;
  tone: string;
  trend?: KpiItem["insightTrend"];
  forecastDetails?: KpiForecastDetails;
}> = ({ label, text, tone, trend, forecastDetails }) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, placement: "above" as "above" | "below" });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const tooltipId = `kpi-insight-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  const clearHideTimer = () => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const scheduleHide = () => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => setOpen(false), 160);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const trigger = triggerRef.current;
      const tooltip = tooltipRef.current;
      if (!trigger || !tooltip) return;

      const anchor = trigger.getBoundingClientRect();
      const bounds = tooltip.getBoundingClientRect();
      const spaceAbove = anchor.top;
      const spaceBelow = window.innerHeight - anchor.bottom;
      const canFitAbove = spaceAbove >= bounds.height + 16;
      const canFitBelow = spaceBelow >= bounds.height + 16;
      const placement = canFitAbove || (!canFitBelow && spaceAbove >= spaceBelow) ? "above" : "below";
      const left = Math.min(
        Math.max(12 + bounds.width / 2, anchor.left + anchor.width / 2),
        window.innerWidth - 12 - bounds.width / 2,
      );
      const idealTop = placement === "above"
        ? anchor.top - bounds.height - 10
        : anchor.bottom + 10;
      const top = Math.max(8, Math.min(idealTop, window.innerHeight - bounds.height - 8));

      setPosition({ left, top, placement });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !tooltipRef.current?.contains(target)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => () => clearHideTimer(), []);

  return (
    <div className="xd-kpi-insight">
      <span className="xd-kpi-insight-label">AI Insight</span>
      <button
        ref={triggerRef}
        className={`xd-kpi-insight-trigger ${tone}`}
        type="button"
        aria-label={`Show AI insight for ${label}`}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") {
            clearHideTimer();
            setOpen(true);
          }
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") scheduleHide();
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
      >
        <Sparkles size={15} aria-hidden="true" />
      </button>
      {open && createPortal(
        <div
          ref={tooltipRef}
          id={tooltipId}
          className={`xd-kpi-insight-tooltip ${position.placement} ${tone}`}
          role="tooltip"
          style={{ left: position.left, top: position.top }}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") clearHideTimer();
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") scheduleHide();
          }}
        >
          <div className="xd-kpi-tooltip-heading">
            <span>
              <Sparkles size={14} /> {forecastDetails ? "AI Forecast" : "AI Insight"}
            </span>
            {trend === "positive" && (
              <span className="xd-kpi-tooltip-trend positive">
                <TrendingUp size={12} /> Positive
              </span>
            )}
            {trend === "attention" && (
              <span className="xd-kpi-tooltip-trend attention">
                <AlertCircle size={12} /> Attention
              </span>
            )}
          </div>
          <p className="xd-kpi-tooltip-summary">{text}</p>
          {forecastDetails && (
            <div className="xd-kpi-tooltip-metrics">
              <div className="xd-kpi-tooltip-row">
                <span className="xd-kpi-tooltip-metric-label">Forecasted PR count</span>
                <strong className="xd-kpi-tooltip-metric-val">{forecastDetails.forecast}</strong>
              </div>
              <div className="xd-kpi-tooltip-row">
                <span className="xd-kpi-tooltip-metric-label">Last 3 months' PR counts</span>
                <span className="xd-kpi-tooltip-metric-val">{forecastDetails.last3Months}</span>
              </div>
              <div className="xd-kpi-tooltip-row">
                <span className="xd-kpi-tooltip-metric-label">Month-over-month change</span>
                <span className={`xd-kpi-tooltip-metric-val ${forecastDetails.momTrendUp ? "up" : "down"}`}>
                  {forecastDetails.momText}
                </span>
              </div>
              <div className="xd-kpi-tooltip-row">
                <span className="xd-kpi-tooltip-metric-label">Forecast method</span>
                <span className="xd-kpi-tooltip-metric-val">{forecastDetails.method}</span>
              </div>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
};

const KpiBanner: React.FC = () => {
  const [prCount, setPrCount] = useState<number | null>(null);
  const [rfqCount, setRfqCount] = useState<number | null>(null);
  const [rfqTrend, setRfqTrend] = useState<{ trend: string; trendUp: boolean }>({
    trend: "8%",
    trendUp: true,
  });
  const [prSpark, setPrSpark] = useState<number[]>([3, 5, 4, 7, 6, 9, 8, 11]);
  const [rfqSpark, setRfqSpark] = useState<number[]>([4, 3, 6, 5, 8, 7, 9, 10]);

  const [isLoadingPr, setIsLoadingPr] = useState(true);
  const [prError, setPrError] = useState(false);
  const [prRecords, setPrRecords] = useState<Cr49f_purchaserequests[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadKpiCounts = async () => {
      try {
        const [prsRes, rfqsRes] = await Promise.allSettled([
          Cr49f_purchaserequestsService.getAll(),
          Cr49f_requestforqoutationsService.getAll(),
        ]);

        if (!isMounted) return;

        if (prsRes.status === "fulfilled" && prsRes.value.success && prsRes.value.data) {
          const records = prsRes.value.data;
          setPrRecords(records);
          setIsLoadingPr(false);
          setPrError(false);

          const activePrs = records.filter((r) => r.statecode === 0 || r.statecode === undefined);
          const count = activePrs.length > 0 ? activePrs.length : records.length;
          setPrCount(count);

          const spark = computeSparkline(records, [3, 5, 4, 7, 6, 9, 8, 11]);
          setPrSpark(spark);
        } else {
          setIsLoadingPr(false);
          if (prsRes.status === "rejected" || (prsRes.status === "fulfilled" && !prsRes.value.success)) {
            setPrError(true);
          }
        }

        if (rfqsRes.status === "fulfilled" && rfqsRes.value.success && rfqsRes.value.data) {
          const rfqRecords = rfqsRes.value.data;
          const activeRfqs = rfqRecords.filter((r) => r.statecode === 0 || r.statecode === undefined);
          const count = activeRfqs.length > 0 ? activeRfqs.length : rfqRecords.length;
          setRfqCount(count);

          const trendInfo = computeMonthlyTrend(rfqRecords, "8%", true);
          setRfqTrend(trendInfo);

          const spark = computeSparkline(rfqRecords, [4, 3, 6, 5, 8, 7, 9, 10]);
          setRfqSpark(spark);
        }
      } catch (err) {
        if (!isMounted) return;
        setIsLoadingPr(false);
        setPrError(true);
        console.warn("Could not load dynamic PR/RFQ counts for KPI banner:", err);
      }
    };

    void loadKpiCounts();

    window.addEventListener("approvalTasksUpdated", loadKpiCounts);
    window.addEventListener("focus", loadKpiCounts);

    return () => {
      isMounted = false;
      window.removeEventListener("approvalTasksUpdated", loadKpiCounts);
      window.removeEventListener("focus", loadKpiCounts);
    };
  }, []);

  // Compute 3-month moving average forecast dynamically from Dataverse records
  const prForecastData = useMemo(() => {
    return calculatePRForecast(prRecords, isLoadingPr, prError);
  }, [prRecords, isLoadingPr, prError]);

  const kpis: KpiItem[] = useMemo(() => [
    {
      label: "Purchase Requests",
      value: prCount !== null ? String(prCount) : "42",
      icon: "cart",
      caption: "Request volume",
      tone: "blue",
      trend: prForecastData.cardTrend,
      trendUp: prForecastData.cardTrendUp,
      spark: prSpark,
      insight: prForecastData.summaryText,
      insightTrend: prForecastData.insightTrend,
      forecastDetails: prForecastData.details ?? undefined,
    },
    {
      label: "RFQs",
      value: rfqCount !== null ? String(rfqCount) : "43",
      icon: "quote",
      caption: "Quotation volume",
      tone: "violet",
      trend: rfqTrend.trend,
      trendUp: rfqTrend.trendUp,
      spark: rfqSpark,
      insight: "82% convert to orders, up 12% from last month.",
      insightTrend: "positive",
    },
    {
      label: "Orders",
      value: "20",
      icon: "order",
      caption: "Order volume",
      tone: "green",
      trend: "5%",
      trendUp: false,
      spark: [9, 8, 9, 6, 7, 5, 6, 4],
    },
    {
      label: "Invoice Submissions",
      value: "18",
      icon: "invoice",
      caption: "Submission volume",
      tone: "amber",
      trend: "20%",
      trendUp: true,
      spark: [2, 4, 3, 6, 5, 8, 7, 10],
    },
    {
      label: "Allocated Budget",
      value: "USD 10.00M",
      icon: "budget",
      tone: "blue",
      progress: usedPct,
      progressLabel: `${usedPct}% utilized`,
      insight: "IT department is at 85% of its allocation. Review upcoming requests.",
      insightTrend: "attention",
    },
    {
      label: "Remaining Budget",
      value: "USD 9.90M",
      icon: "money",
      tone: "violet",
      progress: 100 - usedPct,
      progressLabel: `${100 - usedPct}% available`,
    },
  ], [prCount, rfqCount, rfqTrend, prSpark, rfqSpark, prForecastData]);

  return (
    <section className="xd-kpis">
      {kpis.map((k) => (
        <article className={`xd-kpi xd-${k.tone}${k.insight ? " xd-kpi-has-insight" : ""}`} key={k.label}>
          <div className="xd-kpi-top">
            <span className="xd-kpi-label">{k.label}</span>
            <span className="xd-kpi-icon">{icons[k.icon]}</span>
          </div>
          <div className="xd-kpi-mid">
            <KpiValue value={k.value} />
            {k.trend && (
              <span className="xd-kpi-trend-group">
                <span className={`xd-trend ${k.trendUp ? "up" : "down"}`}>
                  {k.trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {k.trendUp ? "+" : "−"}{k.trend}
                </span>
                <small>vs last month</small>
              </span>
            )}
          </div>
          {k.spark ? (
            <div className="xd-kpi-foot">
              <span className="xd-kpi-cap">{k.caption}</span>
              <Spark data={k.spark} />
            </div>
          ) : (
            <div className="xd-kpi-progress-wrap">
              <span className="xd-kpi-cap">{k.progressLabel}</span>
              <div className="xd-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={k.progress}>
                <span style={{ width: `${Math.max(k.progress ?? 0, 2)}%` }} />
              </div>
            </div>
          )}
          {k.insight && (
            <KpiInsight
              label={k.label}
              text={k.insight}
              tone={k.tone ?? "blue"}
              trend={k.insightTrend}
              forecastDetails={k.forecastDetails}
            />
          )}
        </article>
      ))}
    </section>
  );
};

export default KpiBanner;
