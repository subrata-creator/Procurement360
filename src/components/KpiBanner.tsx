import React from "react";
import type { KpiItem } from "../types/dashboard";
import { ShoppingCart, ClipboardList, PackageCheck, FileText, BarChart3, FileCheck2, TrendingUp, TrendingDown } from "lucide-react";

const ALLOCATED = 10.0; // USD millions
const REMAINING = 9.9;
const usedPct = Math.round(((ALLOCATED - REMAINING) / ALLOCATED) * 100);

const kpis: KpiItem[] = [
  { label: "Purchase Requests", value: "42", icon: "cart", caption: "Request volume", tone: "blue", trend: "12%", trendUp: true, spark: [3, 5, 4, 7, 6, 9, 8, 11] },
  { label: "RFQs", value: "43", icon: "quote", caption: "Quotation volume", tone: "violet", trend: "8%", trendUp: true, spark: [4, 3, 6, 5, 8, 7, 9, 10] },
  { label: "Orders", value: "20", icon: "order", caption: "Order volume", tone: "green", trend: "5%", trendUp: false, spark: [9, 8, 9, 6, 7, 5, 6, 4] },
  { label: "Invoice Submissions", value: "18", icon: "invoice", caption: "Submission volume", tone: "amber", trend: "20%", trendUp: true, spark: [2, 4, 3, 6, 5, 8, 7, 10] },
  { label: "Allocated Budget", value: "USD 10.00M", icon: "budget", tone: "blue", progress: usedPct, progressLabel: `${usedPct}% utilized` },
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

const KpiBanner: React.FC = () => (
  <section className="xd-kpis">
    {kpis.map((k) => (
      <article className={`xd-kpi xd-${k.tone}`} key={k.label}>
        <div className="xd-kpi-top">
          <span className="xd-kpi-label">{k.label}</span>
          <span className="xd-kpi-icon">{icons[k.icon]}</span>
        </div>
        <div className="xd-kpi-mid">
          <strong>{k.value}</strong>
          {k.trend && (
            <span className={`xd-trend ${k.trendUp ? "up" : "down"}`}>
              {k.trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {k.trend}
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
      </article>
    ))}
  </section>
);

export default KpiBanner;