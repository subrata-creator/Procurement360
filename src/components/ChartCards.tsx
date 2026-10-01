import React, { useState } from "react";
import { BarChart3, ShoppingCart, PieChart } from "lucide-react";

type Item = { label: string; value: number; color?: string; comparison?: string; observation?: string };
type CardProps = { title: string; legend: string; icon: React.ReactNode; items: Item[] };
type BarCardProps = CardProps & { ticks: number[] };

const BarCard: React.FC<BarCardProps> = ({ title, legend, icon, items, ticks }) => {
  const max = ticks[0];
  const [activeItem, setActiveItem] = useState<string | null>(null);
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
            <div
              className={`xd-col${activeItem === it.label ? " active" : ""}`}
              key={it.label}
              tabIndex={0}
              aria-label={`${it.label}: ${it.value}${it.comparison ? `, ${it.comparison}` : ""}`}
              onMouseEnter={() => setActiveItem(it.label)}
              onMouseLeave={() => setActiveItem(null)}
              onFocus={() => setActiveItem(it.label)}
              onBlur={() => setActiveItem(null)}
            >
              <div className="xd-bar" style={{ height: `${(it.value / max) * 100}%` }} />
              {activeItem === it.label && (
                <div className="xd-chart-tooltip" role="status">
                  <strong>{it.label}</strong>
                  <span>{legend}: {it.value}</span>
                  {it.comparison && <small>{it.comparison}</small>}
                  {it.observation && <small className="ai-note"><span>AI</span>{it.observation}</small>}
                </div>
              )}
              <small>{it.label}</small>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const PieCard: React.FC<CardProps> = ({
  title,
  legend,
  icon,
  items,
}) => {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  const gradient = items.map((item, index) => {
    const previousTotal = items
      .slice(0, index)
      .reduce((sum, previous) => sum + previous.value, 0);
    const start = (previousTotal / total) * 100;
    const end = ((previousTotal + item.value) / total) * 100;

    return `${item.color || "#38BDF8"} ${start}% ${end}%`;
  }).join(", ");

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
            <li key={item.label} title={`${item.label}: ${item.value} orders`}>
              <span
                className="xd-pie-dot"
                style={{
                  background: item.color || "#38BDF8",
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

    </section>
  );
};
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthly = [6, 4, 9, 12, 17, 24, 20, 12, 16, 10, 14, 9];

const ChartCards: React.FC = () => (
  <div className="xd-charts">
    <BarCard
      title="RFQ Breakout By Months" legend="RFQ Count" icon={<BarChart3 size={15} />}
      items={months.map((month, index) => ({
        label: month,
        value: monthly[index],
        comparison: index === 0 ? "Baseline month" : `${monthly[index] >= monthly[index - 1] ? "+" : ""}${monthly[index] - monthly[index - 1]} vs ${months[index - 1]}`,
        ...(index === 4 && { observation: "Current forecast indicates an 18% increase next month." }),
      }))} ticks={[24, 18, 12, 6, 0]}
    />
    <BarCard
      title="Suppliers By Orders" legend="Order Count" icon={<ShoppingCart size={15} />}
      items={[{ label: "Dell Inc.", value: 25 }, { label: "TechScan", value: 70 }, { label: "ITC", value: 100, observation: "Highest displayed order count." }, { label: "Logitech", value: 92 }, { label: "Pidilite", value: 40 }]}
      ticks={[100, 75, 50, 25, 0]}
    />
    <PieCard
      title="Orders By Department" legend="Order Count" icon={<PieChart size={15} />}
      items={[
        { label: "ADM", value: 80, color: "#17222C" },
        { label: "HR", value: 200, color: "#38BDF8" },
        { label: "PDT", value: 130, color: "#F59E0B" },
        { label: "IT", value: 160, color: "#22C55E" },
      ]}
    />
  </div>
);

export default ChartCards;