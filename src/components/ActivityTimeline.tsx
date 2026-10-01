import React, { useState } from "react";
import { FileText, ReceiptText } from "lucide-react";
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
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const grouped = shown.reduce<Record<string, Activity[]>>((groups, activity) => {
    const activityDate = new Date(activity.date);
    const dayStart = new Date(activityDate.getFullYear(), activityDate.getMonth(), activityDate.getDate()).getTime();
    const group = dayStart === todayStart ? "Today" : dayStart === yesterdayStart ? "Yesterday" : "Earlier";
    (groups[group] ??= []).push(activity);
    return groups;
  }, {});

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
        {(["Today", "Yesterday", "Earlier"] as const).map((group) => grouped[group]?.length ? (
          <section className="xa-group" key={group}>
            <h3>{group}</h3>
            {grouped[group].map((activity) => (
              <div className="xa-item" key={activity.id}>
                <span className={`xa-dot ${activity.type === "Invoice" ? "invoice" : "pr"}`}>
                  {activity.type === "Invoice" ? <ReceiptText size={11} /> : <FileText size={11} />}
                </span>
                <div>
                  <div className="xa-title">{activity.title}</div>
                  <div className="xa-meta">{activity.actor ? `${activity.actor} | ` : ""}{activity.date}</div>
                </div>
                <span className={`xa-badge ${activity.type === "Invoice" ? "inv" : "pr"}`}>{activity.type}</span>
              </div>
            ))}
          </section>
        ) : null)}
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