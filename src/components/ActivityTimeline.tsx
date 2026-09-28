import React, { useState } from "react";
import type { Activity } from "../types/dashboard";

const activities: Activity[] = [
  { id: 1, type: "PR", title: "PR-2026-090 | PR for First Aid Kit has been Initiated by -", date: "8/4/2026, 5:22 PM" },
  { id: 2, type: "PR", title: "PR-2026-089 | PR for First Aid Kit has been Initiated by -", date: "8/4/2026, 3:31 PM" },
  { id: 3, type: "Invoice", title: "INV-2026-032 | has been Approved by Finance Manager - Information Technology", actor: "Akash Singh", date: "4/3/2026, 12:29 PM" },
  { id: 4, type: "Invoice", title: "INV-2026-032 | has been Approved by Procurement Manager - Information Technology", actor: "Aman Jain", date: "4/3/2026, 12:29 PM" },
  { id: 5, type: "Invoice", title: "INV-2026-032 | has been Approved by Business User - Information Technology", actor: "Sakshi Paliwal", date: "4/3/2026, 12:28 PM" },
  { id: 6, type: "PR", title: "PR-2026-088 | IT equipment request has been submitted for approval", actor: "Subrat Dey", date: "4/2/2026, 10:16 AM" },
  { id: 7, type: "Invoice", title: "INV-2026-031 | invoice has been submitted for review", actor: "Sakshi Paliwal", date: "4/2/2026, 9:45 AM" },
];

const ActivityTimeline: React.FC = () => {
  const [filter, setFilter] = useState("All");
  const [visible, setVisible] = useState(5);

  const list = filter === "All" ? activities : activities.filter((a) => a.type === filter);
  const shown = list.slice(0, visible);

  return (
    <aside className="xa">
      <div className="xa-head">
        <h2>Activity Timeline</h2>
        <select value={filter} aria-label="Filter activity" onChange={(e) => { setFilter(e.target.value); setVisible(5); }}>
          <option value="All">-- All --</option>
          <option value="PR">PR</option>
          <option value="Invoice">Invoice</option>
        </select>
      </div>

      <div className="xa-list">
        {shown.map((a) => (
          <div className="xa-item" key={a.id}>
            <span className="xa-dot">✓</span>
            <div>
              <div className="xa-title">{a.title}</div>
              <div className="xa-meta">{a.actor ? `${a.actor} | ` : ""}{a.date}</div>
            </div>
            <span className={`xa-badge ${a.type === "Invoice" ? "inv" : "pr"}`}>{a.type}</span>
          </div>
        ))}
      </div>

      {shown.length < list.length && (
        <button type="button" className="xa-more" onClick={() => setVisible((v) => v + 5)}>
          ↻ Load more ({list.length - shown.length})
        </button>
      )}
    </aside>
  );
};

export default ActivityTimeline;