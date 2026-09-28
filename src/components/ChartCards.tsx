import React from "react";
import { BarChart3, ShoppingCart, Users, TrendingUp, Lightbulb, Sparkles } from "lucide-react";

type Item = { label: string; value: number };
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
    <BarCard
      title="Orders By Department" legend="Order Count" icon={<Users size={15} />}
      items={[{ label: "ADM", value: 80 }, { label: "HR", value: 200 }, { label: "PDT", value: 130 }, { label: "IT", value: 160 }]}
      ticks={[200, 150, 100, 50, 0]}
      predTone="orange" predIcon={<Lightbulb size={20} />}
      prediction="IT department spend may exceed its allocated budget by 8% if the current trend continues."
    />
  </div>
);

export default ChartCards;