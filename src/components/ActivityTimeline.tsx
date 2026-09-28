import React, { useState } from "react";
import type { Activity } from "../types/dashboard";

const activities: Activity[] = [
  {
    id: 1,
    type: "PR",
    title:
      "PR-2026-090 | PR for First Aid Kit has been Initiated by -",
    date: "8/4/2026, 5:22 PM",
  },
  {
    id: 2,
    type: "PR",
    title:
      "PR-2026-089 | PR for First Aid Kit has been Initiated by -",
    date: "8/4/2026, 3:31 PM",
  },
  {
    id: 3,
    type: "Invoice",
    title:
      "INV-2026-032 | has been Approved by Finance Manager - Information Technology",
    actor: "Akash Singh",
    date: "4/3/2026, 12:29 PM",
  },
  {
    id: 4,
    type: "Invoice",
    title:
      "INV-2026-032 | has been Approved by Procurement Manager - Information Technology",
    actor: "Aman Jain",
    date: "4/3/2026, 12:29 PM",
  },
  {
    id: 5,
    type: "Invoice",
    title:
      "INV-2026-032 | has been Approved by Business User - Information Technology",
    actor: "Sakshi Paliwal",
    date: "4/3/2026, 12:28 PM",
  },
  {
    id: 6,
    type: "PR",
    title:
      "PR-2026-088 | IT equipment request has been submitted for approval",
    actor: "Subrat Dey",
    date: "4/2/2026, 10:16 AM",
  },
  {
    id: 7,
    type: "Invoice",
    title:
      "INV-2026-031 | invoice has been submitted for review",
    actor: "Sakshi Paliwal",
    date: "4/2/2026, 9:45 AM",
  },
];

const ActivityTimeline: React.FC = () => {
  const [filter, setFilter] = useState("All");
  const [visibleCount, setVisibleCount] = useState(5);

  const filteredActivities =
    filter === "All"
      ? activities
      : activities.filter(
          (activity) => activity.type === filter
        );
  const visibleActivities = filteredActivities.slice(0, visibleCount);

  return (
    <aside className="timeline-panel">
      <div className="timeline-header">
        <h2>Activity Timeline</h2>

        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setVisibleCount(5);
          }}
        >
          <option value="All">-- All --</option>
          <option value="PR">PR</option>
          <option value="Invoice">Invoice</option>
        </select>
      </div>

      <div className="timeline-list">
        {visibleActivities.map((activity) => (
          <div
            className="timeline-item"
            key={activity.id}
          >
            <div className="timeline-marker">
              ✓
            </div>

            <div className="timeline-content">
              <div className="timeline-title-row">
                <div className="timeline-title">
                  {activity.title}
                </div>

                <span
                  className={`timeline-badge ${
                    activity.type === "Invoice"
                      ? "invoice"
                      : "pr"
                  }`}
                >
                  {activity.type}
                </span>
              </div>

              <div className="timeline-meta">
                {activity.actor && (
                  <>
                    <span>{activity.actor}</span>
                    <span>|</span>
                  </>
                )}

                <span>{activity.date}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {visibleActivities.length < filteredActivities.length && (
        <button
          type="button"
          className="load-more-button"
          onClick={() => setVisibleCount((count) => count + 5)}
        >
          ↻ Load more ({filteredActivities.length - visibleActivities.length})
        </button>
      )}
    </aside>
  );
};

export default ActivityTimeline;