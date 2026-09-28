import React from "react";
import { Sparkles, TrendingUp, Lightbulb, FileCheck2, PackageCheck } from "lucide-react";

type Insight = { title: string; value: string; text: string; tone: "green" | "orange" | "blue" | "violet"; icon: React.ReactNode };

// TODO: replace with live output from AI Builder / Copilot Studio / your API.
const insights: Insight[] = [
  { title: "PR Approval Time Improved", value: "30% faster", text: "Average approval time reduced from 5 days to 3.5 days this month.", tone: "green", icon: <TrendingUp size={22} /> },
  { title: "Budget Utilization Alert", value: "78% utilized", text: "IT department is at 85% of allocated budget. Consider reviewing upcoming requests.", tone: "orange", icon: <Lightbulb size={22} /> },
  { title: "High RFQ Conversion Rate", value: "82%", text: "RFQs to Orders conversion increased by 12% compared to last month.", tone: "blue", icon: <FileCheck2 size={22} /> },
  { title: "Top Spending Category", value: "IT Equipments", text: "45% of total spend this month.", tone: "violet", icon: <PackageCheck size={22} /> },
];

const AiInsights: React.FC = () => (
  <section className="xd-panel xd-ai">
    <header className="xd-panel-head">
      <span className="xd-badge-icon violet"><Sparkles size={20} /></span>
      <div>
        <h2>AI Insights</h2>
        <p>Key insights and recommendations based on your procurement data</p>
      </div>
    </header>
    <div className="xd-insight-grid">
      {insights.map((i) => (
        <article className={`xd-insight ${i.tone}`} key={i.title}>
          <span className="xd-insight-icon">{i.icon}</span>
          <div>
            <span className="xd-insight-title">{i.title}</span>
            <strong>{i.value}</strong>
            <p>{i.text}</p>
          </div>
        </article>
      ))}
    </div>
  </section>
);

export default AiInsights;