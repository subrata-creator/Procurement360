import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { taskInboxItems } from "../data/tasks";

const PAGE_SIZE = 5;

const TaskInbox: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    "inbox" | "contract"
  >("inbox");

  const [taskSearch, setTaskSearch] = useState("");
  const [typeSearch, setTypeSearch] = useState("");
  const [assignedSearch, setAssignedSearch] = useState("");
  const [dateSearch, setDateSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredTasks = useMemo(() => {
    return taskInboxItems.filter((task) => {
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

  const visibleTasks = activeTab === "inbox" ? filteredTasks : [];
  const totalPages = Math.max(1, Math.ceil(visibleTasks.length / PAGE_SIZE));
  const startIndex = visibleTasks.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE;
  const pagedTasks = visibleTasks.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <section className="task-section">
      <div className="task-tabs">
        <button
          type="button"
          className={`task-tab ${
            activeTab === "inbox" ? "active" : ""
          }`}
          onClick={() => {
            setActiveTab("inbox");
            setCurrentPage(1);
          }}
        >
          TASK INBOX
        </button>

        <button
          type="button"
          className={`task-tab ${
            activeTab === "contract" ? "active" : ""
          }`}
          onClick={() => {
            setActiveTab("contract");
            setCurrentPage(1);
          }}
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
                  onChange={(e) => {
                    setCurrentPage(1);
                    setTaskSearch(e.target.value)
                  }}
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
                  onChange={(e) => {
                    setCurrentPage(1);
                    setTypeSearch(e.target.value)
                  }}
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
                  onChange={(e) => {
                    setCurrentPage(1);
                    setAssignedSearch(e.target.value)
                  }}
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
                    onChange={(e) => {
                      setCurrentPage(1);
                      setDateSearch(e.target.value)
                    }}
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
              pagedTasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <button
                      type="button"
                      className="task-name"
                      onClick={() => navigate(`/tasks/${task.id}`)}
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

      </div>
      <div className="table-footer">
        <div className="pagination">
          <button type="button" aria-label="First page" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>⇤</button>
          <button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>←</button>
          <span>
            Showing {visibleTasks.length === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + PAGE_SIZE, visibleTasks.length)} of {visibleTasks.length}
          </span>
          <button type="button" aria-label="Next page" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>→</button>
          <button type="button" aria-label="Last page" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>⇥</button>
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