import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { KpiItem } from "../types/dashboard";
import { ShoppingCart, ClipboardList, PackageCheck, FileText, BarChart3, FileCheck2, TrendingUp, TrendingDown, Sparkles, AlertCircle } from "lucide-react";

const ALLOCATED = 10.0; // USD millions
const REMAINING = 9.9;
const usedPct = Math.round(((ALLOCATED - REMAINING) / ALLOCATED) * 100);

const kpis: KpiItem[] = [
  { label: "Purchase Requests", value: "42", icon: "cart", caption: "Request volume", tone: "blue", trend: "12%", trendUp: true, spark: [3, 5, 4, 7, 6, 9, 8, 11], insight: "Approval time is 30% faster this month, down from 5 days to 3.5.", insightTrend: "positive" },
  { label: "RFQs", value: "43", icon: "quote", caption: "Quotation volume", tone: "violet", trend: "8%", trendUp: true, spark: [4, 3, 6, 5, 8, 7, 9, 10], insight: "82% convert to orders, up 12% from last month.", insightTrend: "positive" },
  { label: "Orders", value: "20", icon: "order", caption: "Order volume", tone: "green", trend: "5%", trendUp: false, spark: [9, 8, 9, 6, 7, 5, 6, 4] },
  { label: "Invoice Submissions", value: "18", icon: "invoice", caption: "Submission volume", tone: "amber", trend: "20%", trendUp: true, spark: [2, 4, 3, 6, 5, 8, 7, 10] },
  { label: "Allocated Budget", value: "USD 10.00M", icon: "budget", tone: "blue", progress: usedPct, progressLabel: `${usedPct}% utilized`, insight: "IT department is at 85% of its allocation. Review upcoming requests.", insightTrend: "attention" },
  { label: "Remaining Budget", value: "USD 9.90M", icon: "money", tone: "violet", progress: 100 - usedPct, progressLabel: `${100 - usedPct}% available` },
];

const icons: Record<string, React.ReactNode> = {
  cart: <ShoppingCart size={18} />,
  quote: <ClipboardList size={18} />,
  order: <PackageCheck size={18} />,
  invoice: <FileText size={18} />,
  budget: <BarChart3 size={18} />,
  money: <FileCheck2 size={18} />,
};

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

const KpiInsight: React.FC<{ label: string; text: string; tone: string; trend?: KpiItem["insightTrend"] }> = ({ label, text, tone, trend }) => {
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
            <span><Sparkles size={14} /> AI Insight</span>
            {trend === "positive" && <span className="xd-kpi-tooltip-trend positive"><TrendingUp size={12} /> Positive</span>}
            {trend === "attention" && <span className="xd-kpi-tooltip-trend attention"><AlertCircle size={12} /> Attention</span>}
          </div>
          <p>{text}</p>
        </div>,
        document.body,
      )}
    </div>
  );
};

const KpiBanner: React.FC = () => (
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
          <KpiInsight label={k.label} text={k.insight} tone={k.tone ?? "blue"} trend={k.insightTrend} />
        )}
      </article>
    ))}
  </section>
);

export default KpiBanner;