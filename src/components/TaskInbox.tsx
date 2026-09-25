import React, { useMemo, useState } from "react";
import type { Task } from "../types/dashboard";

const tasks: Task[] = [
  {
    id: 1,
    taskName:
      "Invoice Approvals for Business Owner - Invoice Approval for INV-2026-031",
    taskType: "Invoice",
    assignedTo: "Sakshi Paliwal",
    assignedOn: "3/22/2026",
  },
  {
    id: 2,
    taskName:
      "Invoice Approvals for Business Owner - Invoice Approval for INV-2026-030",
    taskType: "Invoice",
    assignedTo: "Sakshi Paliwal",
    assignedOn: "3/20/2026",
  },
  {
    id: 3,
    taskName: "Changes needed for PR- DellInspiron 15 3530",
    taskType: "Purchase Request",
    assignedTo: "Sakshi Paliwal",
    assignedOn: "10/30/2025",
  },
  {
    id: 4,
    taskName: "Changes needed for PR- Lenovo V15 Gen 4",
    taskType: "Purchase Request",
    assignedTo: "Sakshi Paliwal",
    assignedOn: "10/30/2025",
  },
  {
    id: 5,
    taskName: "RFQ Approvals for RFQ-2025-019",
    taskType: "Request for Quotation",
    assignedTo: "Sakshi Paliwal",
    assignedOn: "10/6/2025",
  },
  {
    id: 6,
    taskName: "RFQ Approvals for RFQ-2025-018",
    taskType: "Request for Quotation",
    assignedTo: "Sakshi Paliwal",
    assignedOn: "8/7/2025",
  },
];

const TaskInbox: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "inbox" | "contract"
  >("inbox");

  const [taskSearch, setTaskSearch] = useState("");
  const [typeSearch, setTypeSearch] = useState("");
  const [assignedSearch, setAssignedSearch] = useState("");
  const [dateSearch, setDateSearch] = useState("");

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesTask =
        task.taskName
          .toLowerCase()
          .includes(taskSearch.toLowerCase());

      const matchesType =
        task.taskType
          .toLowerCase()
          .includes(typeSearch.toLowerCase());

      const matchesAssigned =
        task.assignedTo
          .toLowerCase()
          .includes(assignedSearch.toLowerCase());

      const matchesDate =
        task.assignedOn
          .toLowerCase()
          .includes(dateSearch.toLowerCase());

      return (
        matchesTask &&
        matchesType &&
        matchesAssigned &&
        matchesDate
      );
    });
  }, [
    taskSearch,
    typeSearch,
    assignedSearch,
    dateSearch,
  ]);

  return (
    <section className="task-section">
      <div className="task-tabs">
        <button
          type="button"
          className={`task-tab ${
            activeTab === "inbox" ? "active" : ""
          }`}
          onClick={() => setActiveTab("inbox")}
        >
          TASK INBOX
        </button>

        <button
          type="button"
          className={`task-tab ${
            activeTab === "contract" ? "active" : ""
          }`}
          onClick={() => setActiveTab("contract")}
        >
          CONTRACT SIGNATORY TASKS
        </button>
      </div>

      <div className="task-table-wrapper">
        <table className="task-table">
          <thead>
            <tr>
              <th>
                <div className="column-heading">
                  <span>Task Name</span>
                  <span className="sort-icon">↕</span>
                </div>

                <input
                  type="text"
                  placeholder="--Search--"
                  value={taskSearch}
                  onChange={(e) =>
                    setTaskSearch(e.target.value)
                  }
                />
              </th>

              <th>
                <div className="column-heading">
                  <span>Task Type</span>
                  <span className="sort-icon">↕</span>
                </div>

                <input
                  type="text"
                  placeholder="--Search--"
                  value={typeSearch}
                  onChange={(e) =>
                    setTypeSearch(e.target.value)
                  }
                />
              </th>

              <th>
                <div className="column-heading">
                  <span>Assigned To</span>
                  <span className="sort-icon">↕</span>
                </div>

                <input
                  type="text"
                  placeholder="--Search--"
                  value={assignedSearch}
                  onChange={(e) =>
                    setAssignedSearch(e.target.value)
                  }
                />
              </th>

              <th>
                <div className="column-heading">
                  <span>Assigned On</span>
                  <span className="sort-icon">↕</span>
                </div>

                <div className="date-search">
                  <span className="filter-symbol">=</span>

                  <input
                    type="text"
                    placeholder="--Search--"
                    value={dateSearch}
                    onChange={(e) =>
                      setDateSearch(e.target.value)
                    }
                  />

                  <button
                    type="button"
                    className="calendar-button"
                    aria-label="Select date"
                  >
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <rect
                        x="3"
                        y="4"
                        width="18"
                        height="17"
                        rx="2"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M8 2V6M16 2V6M3 9H21"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                  </button>
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            {activeTab === "contract" ? (
              <tr>
                <td
                  colSpan={4}
                  className="empty-state"
                >
                  No contract signatory tasks available.
                </td>
              </tr>
            ) : (
              filteredTasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <button
                      type="button"
                      className="task-name"
                    >
                      {task.taskName}
                    </button>
                  </td>

                  <td>
                    <span
                      className={`task-badge ${getBadgeClass(
                        task.taskType
                      )}`}
                    >
                      {task.taskType}
                    </span>
                  </td>

                  <td>
                    <div className="assigned-user">
                      <div className="small-avatar">
                        SP
                      </div>
                      <span>{task.assignedTo}</span>
                    </div>
                  </td>

                  <td>
                    <div className="assigned-date">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <rect
                          x="3"
                          y="4"
                          width="18"
                          height="17"
                          rx="2"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        />
                        <path
                          d="M8 2V6M16 2V6M3 9H21"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        />
                        <path
                          d="M8 13L10 15L16 11"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>

                      <span>{task.assignedOn}</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="table-footer">
          <div className="pagination">
            <button type="button">|◀</button>
            <button type="button">◀</button>
            <span>
              1 to {filteredTasks.length} of 18
            </span>
            <button type="button">▶</button>
            <button type="button">▶|</button>
          </div>
        </div>
      </div>
    </section>
  );
};

function getBadgeClass(type: string): string {
  if (type === "Invoice") {
    return "invoice";
  }

  if (type === "Purchase Request") {
    return "purchase";
  }

  return "rfq";
}

export default TaskInbox;