import React from "react";
import { BarChart3, ShoppingCart, PieChart, TrendingUp, Lightbulb, Sparkles } from "lucide-react";

type Item = { label: string; value: number; color?: string };
type Props = {
  title: string; legend: string; icon: React.ReactNode; items: Item[];
  ticks: number[]; predTone: "violet" | "green" | "orange"; predIcon: React.ReactNode; prediction: string;
};

const BarCard: React.FC<Props> = ({ title, legend, icon, items, ticks, predTone, predIcon, prediction }) => {
  const max = ticks[0];
  return (
    <section className="xd-panel xd-chart">
      <header className="xd-chart-head">
        <span className="xd-badge-icon sm blue">{icon}</span>
        <h3>{title}</h3>
        <span className="xd-legend"><i />{legend}</span>
      </header>
      <div className="xd-plot">
        <div className="xd-yaxis">{ticks.map((t) => <span key={t}>{t}</span>)}</div>
        <div className="xd-bars">
          <div className="xd-grid">{ticks.map((t) => <span key={t} />)}</div>
          {items.map((it) => (
            <div className="xd-col" key={it.label} title={`${it.label}: ${it.value}`}>
              <div className="xd-bar" style={{ height: `${(it.value / max) * 100}%` }} />
              <small>{it.label}</small>
            </div>
          ))}
        </div>
      </div>
      <div className={`xd-pred ${predTone}`}>
        <span className="xd-pred-icon">{predIcon}</span>
        <p><b>AI Prediction</b>{prediction}</p>
      </div>
    </section>
  );
};

const PieCard: React.FC<Props> = ({
  title,
  legend,
  icon,
  items,
  predTone,
  predIcon,
  prediction,
}) => {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  let accumulated = 0;

  const gradient = items
    .map((item) => {
      const start = accumulated;
      accumulated += (item.value / total) * 100;

      return `${item.color || "#2563eb"} ${start}% ${accumulated}%`;
    })
    .join(", ");

  return (
    <section className="xd-panel xd-chart xd-pie-card">

      {/* HEADER */}
      <header className="xd-chart-head">
        <span className="xd-badge-icon sm blue">
          {icon}
        </span>

        <h3>{title}</h3>

        <span className="xd-legend">
          <i />
          {legend}
        </span>
      </header>

      {/* PIE + LEGEND + VALUES */}
      <div className="xd-pie-layout">

        {/* LEFT - PIE */}
        <div className="xd-pie-wrap">
          <div
            className="xd-pie-chart"
            style={{
              background: `conic-gradient(${gradient})`,
            }}
          />

          <div className="xd-pie-center">
            {total}
          </div>
        </div>

        {/* CENTER - LEGEND */}
        <ul className="xd-pie-legend">
          {items.map((item) => (
            <li key={item.label}>
              <span
                className="xd-pie-dot"
                style={{
                  background: item.color || "#2563eb",
                }}
              />

              <span>{item.label}</span>
            </li>
          ))}
        </ul>

        {/* RIGHT - VALUES */}
        <div className="xd-pie-values">
          {items.map((item) => (
            <strong key={item.label}>
              {item.value}
            </strong>
          ))}
        </div>

      </div>

      {/* AI PREDICTION */}
      <div className={`xd-pred ${predTone}`}>
        <span className="xd-pred-icon">
          {predIcon}
        </span>

        <p>
          <b>AI Prediction</b>
          {prediction}
        </p>
      </div>

    </section>
  );
};
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthly = [6, 4, 9, 12, 17, 24, 20, 12, 16, 10, 14, 9];

const ChartCards: React.FC = () => (
  <div className="xd-charts">
    <BarCard
      title="RFQ Breakout By Months" legend="RFQ Count" icon={<BarChart3 size={15} />}
      items={months.map((m, i) => ({ label: m, value: monthly[i] }))} ticks={[24, 18, 12, 6, 0]}
      predTone="violet" predIcon={<Sparkles size={20} />}
      prediction="RFQ volume is expected to increase by 18% in May 2026 based on current trend."
    />
    <BarCard
      title="Suppliers By Orders" legend="Order Count" icon={<ShoppingCart size={15} />}
      items={[{ label: "Dell Inc.", value: 25 }, { label: "TechScan", value: 70 }, { label: "ITC", value: 100 }, { label: "Logitech", value: 92 }, { label: "Pidilite", value: 40 }]}
      ticks={[100, 75, 50, 25, 0]}
      predTone="green" predIcon={<TrendingUp size={20} />}
      prediction="Orders from ITC and Logitech are likely to increase by 25% next month based on historical patterns."
    />
    <PieCard
      title="Orders By Department" legend="Order Count" icon={<PieChart size={15} />}
      items={[
        { label: "ADM", value: 80, color: "#7c3aed" },
        { label: "HR", value: 200, color: "#3b82f6" },
        { label: "PDT", value: 130, color: "#f59e0b" },
        { label: "IT", value: 160, color: "#10b981" },
      ]}
      ticks={[200, 150, 100, 50, 0]}
      predTone="orange" predIcon={<Lightbulb size={20} />}
      prediction="IT department spend may exceed its allocated budget by 8% if the current trend continues."
    />
  </div>
);

export default ChartCards;