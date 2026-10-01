import React, { useState } from "react";
import { FileText, FileCheck2, CheckCircle2, ClipboardList, ShoppingCart, PackageCheck, Lightbulb, ChevronRight } from "lucide-react";

const stages = [
  { label: "Created", count: 42, tone: "blue", icon: <FileText size={20} /> },
  { label: "Under Review", count: 8, tone: "sky", icon: <FileCheck2 size={20} /> },
  { label: "Approved", count: 28, tone: "green", icon: <CheckCircle2 size={20} /> },
  { label: "RFQ Initiated", count: 20, tone: "violet", icon: <ClipboardList size={20} /> },
  { label: "PO Created", count: 16, tone: "orange", icon: <ShoppingCart size={20} /> },
  { label: "Invoice Created", count: 12, tone: "blue", icon: <PackageCheck size={20} /> },
];

type Props = { onViewPending?: () => void };

const PrJourney: React.FC<Props> = ({ onViewPending }) => {
  const [range, setRange] = useState("30");
  const total = stages[0].count;
  return (
    <section className="xd-panel">
      <header className="xd-panel-head">
        <span className="xd-badge-icon blue"><FileText size={20} /></span>
        <div>
          <h2>Purchase Request Journey</h2>
          <p>Track the status of all purchase requests from creation to invoice.</p>
        </div>
        <select className="xd-select" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Journey period">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </header>

      <div className="xd-journey">
        {stages.map((s, i) => (
          <div
            className={`xd-stage ${s.tone}`}
            key={s.label}
            title={`${s.count} requests at ${s.label} · ${Math.round((s.count / total) * 100)}% of created requests. Processing time and aging data are not available in this sample.`}
          >
            <div className="xd-stage-head"><span>{i + 1}</span><strong>{s.label}</strong></div>
            <div className="xd-stage-body">
              <span className="xd-stage-icon">{s.icon}</span>
              <div><b>{s.count}</b><small>{Math.round((s.count / total) * 100)}%</small></div>
            </div>
          </div>
        ))}
      </div>

      <div className="xd-ai-note">
        <span className="xd-note-icon"><Lightbulb size={18} /></span>
        <p><b>AI Insight:</b> 3 PRs are pending in review for more than 7 days. Consider follow-up to avoid delays in procurement cycle.</p>
        <button type="button" onClick={onViewPending}>View Pending PRs <ChevronRight size={14} /></button>
      </div>
    </section>
  );
};

export default PrJourney;