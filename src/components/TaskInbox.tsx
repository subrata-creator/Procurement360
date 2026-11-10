import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  ReceiptText,
  RotateCcw,
  ScrollText,
  Search,
  X,
} from "lucide-react";
import { taskInboxItems } from "../data/tasks";
import { Cr49f_approvaltasksesService } from "../generated/services/Cr49f_approvaltasksesService";
import { Cr49f_purchaserequestsService } from "../generated/services/Cr49f_purchaserequestsService";
import { Cr49f_requestforqoutationsService } from "../generated/services/Cr49f_requestforqoutationsService";
import {
  getTaskApprovalStatusLabel,
  cleanGuid,
  createApprovalTasksForObject,
  extractTaskParentIds,
} from "../Services/ApprovalWorkflowService";

const PAGE_SIZE = 4;

export interface WorkQueueItem {
  id: string;
  taskName: string;
  taskType:
    | "Purchase Request"
    | "Request for Quotation"
    | "Purchase Order"
    | "Invoice"
    | "Contract";
  assignedTo: string;
  assignedOn: string;
  description?: string;
  priority?: "Low" | "Normal" | "High";
  status: "Pending" | "Approved" | "Rejected" | "Changes Needed";
  isActive: boolean;
  targetUrl: string;
  sequence?: number;
  createdOnTime?: number;
  rawCreatedDate?: string;
}

const badge = (t: string) =>
  t === "Invoice"
    ? "inv"
    : t === "Purchase Request"
    ? "pr"
    : t === "Purchase Order"
    ? "po"
    : "rfq";

const TaskInbox: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [dataverseTasks, setDataverseTasks] = useState<WorkQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tasksRes, prsRes, rfqsRes] = await Promise.allSettled([
        Cr49f_approvaltasksesService.getAll(),
        Cr49f_purchaserequestsService.getAll(),
        Cr49f_requestforqoutationsService.getAll(),
      ]);

      const rawTasks =
        tasksRes.status === "fulfilled" &&
        tasksRes.value.success &&
        tasksRes.value.data
          ? tasksRes.value.data
          : [];
      const prs =
        prsRes.status === "fulfilled" &&
        prsRes.value.success &&
        prsRes.value.data
          ? prsRes.value.data
          : [];
      const rfqs =
        rfqsRes.status === "fulfilled" &&
        rfqsRes.value.success &&
        rfqsRes.value.data
          ? rfqsRes.value.data
          : [];

      // Auto-heal: If any PR or RFQ does not have approval tasks generated, create them dynamically
      for (const pr of prs) {
        const prId = cleanGuid(pr.cr49f_purchaserequestid);
        if (!prId) continue;
        const hasTasks = rawTasks.some((t) => extractTaskParentIds(t).prId === prId);
        if (!hasTasks) {
          try {
            const created = await createApprovalTasksForObject({
              objectType: 1,
              recordId: prId,
              recordName: pr.cr49f_prtitle || "Purchase Request Approval",
            });
            rawTasks.push(...created);
          } catch (prTaskErr) {
            console.warn(`[TaskInbox] Could not auto-generate tasks for PR ${prId}:`, prTaskErr);
          }
        }
      }

      for (const rfq of rfqs) {
        const rfqId = cleanGuid(rfq.cr49f_requestforqoutationid);
        if (!rfqId) continue;
        const hasTasks = rawTasks.some((t) => extractTaskParentIds(t).rfqId === rfqId);
        if (!hasTasks) {
          try {
            const created = await createApprovalTasksForObject({
              objectType: 2,
              recordId: rfqId,
              recordName: rfq.cr49f_rfqtitle || "RFQ Approval",
            });
            rawTasks.push(...created);
          } catch (rfqTaskErr) {
            console.warn(`[TaskInbox] Could not auto-generate tasks for RFQ ${rfqId}:`, rfqTaskErr);
          }
        }
      }

      // Pre-group rawTasks by parent PR, RFQ, PO so we can accurately evaluate sequential approval progression
      const tasksByPr = new Map<string, typeof rawTasks>();
      const tasksByRfq = new Map<string, typeof rawTasks>();
      const tasksByPo = new Map<string, typeof rawTasks>();

      for (const t of rawTasks) {
        const { prId, rfqId, poId } = extractTaskParentIds(t);
        if (prId) {
          if (!tasksByPr.has(prId)) tasksByPr.set(prId, []);
          tasksByPr.get(prId)!.push(t);
        }
        if (rfqId) {
          if (!tasksByRfq.has(rfqId)) tasksByRfq.set(rfqId, []);
          tasksByRfq.get(rfqId)!.push(t);
        }
        if (poId) {
          if (!tasksByPo.has(poId)) tasksByPo.set(poId, []);
          tasksByPo.get(poId)!.push(t);
        }
      }

      const mapped: WorkQueueItem[] = rawTasks.map((t, idx) => {
        const raw = t as unknown as Record<string, unknown>;
        const { prId, rfqId, poId } = extractTaskParentIds(t);

        const statusLabel = getTaskApprovalStatusLabel(t);
        const taskId = cleanGuid(t.cr49f_approvaltasksid) || String(idx);

        // Record status check: statecode 0 is Active, statuscode 2 is Inactive
        const sc = t.statecode ?? (raw.statecode as number) ?? (raw.StateCode as number);
        const stc = t.statuscode ?? (raw.statuscode as number) ?? (raw.StatusCode as number);
        const isRecordActive =
          (sc === 0 || sc === undefined || Number(sc) === 0) &&
          Number(stc ?? 1) !== 2;

        const localActive = taskId && typeof window !== "undefined"
          ? localStorage.getItem(`task_active_${taskId}`)
          : null;

        // Check if parent PR or RFQ is in Changes Needed status
        const prStatus = prId && typeof window !== "undefined" ? localStorage.getItem(`pr_status_${prId}`) : null;
        const rfqStatus = rfqId && typeof window !== "undefined" ? localStorage.getItem(`rfq_status_${rfqId}`) : null;
        const isParentChangesNeeded = prStatus === "Changes Needed" || rfqStatus === "Changes Needed";

        // Check if parent PR is completed/approved
        const parentPR = prId ? prs.find((p) => cleanGuid(p.cr49f_purchaserequestid) === prId) : null;
        const isParentPrApproved = parentPR?.cr49f_status === 1 || (prId && typeof window !== "undefined" && localStorage.getItem(`pr_status_${prId}`) === "Approved");

        let isActive = false;

        // 1. Approved or Rejected tasks are NEVER active in the work queue
        if (statusLabel === "Approved" || statusLabel === "Rejected" || Boolean(t.cr49f_approvedby && t.cr49f_approvedon)) {
          isActive = false;
          if (taskId && typeof window !== "undefined") {
            localStorage.setItem(`task_active_${taskId}`, "false");
          }
        }
        // 2. If parent PR or RFQ is in Changes Needed, all sequential tasks (sequence >= 1) are inactive
        else if (isParentChangesNeeded) {
          if (statusLabel === "Changes Needed" || (t.cr49f_sequence ?? 0) === 0) {
            isActive = true;
          } else {
            isActive = false;
          }
        }
        // 3. Changes Needed task
        else if (statusLabel === "Changes Needed" || (t.cr49f_sequence ?? 0) === 0) {
          isActive = localActive !== "false";
        }
        // 4. If parent PR is fully approved, no tasks should be active
        else if (isParentPrApproved) {
          isActive = false;
        }
        // 5. Normal Pending sequential task (statusLabel === "Pending")
        else {
          // Check sibling tasks for the same parent record
          const siblings = prId
            ? (tasksByPr.get(prId) ?? [])
            : rfqId
            ? (tasksByRfq.get(rfqId) ?? [])
            : poId
            ? (tasksByPo.get(poId) ?? [])
            : [];

          const sequentialSiblings = siblings
            .filter((s) => (s.cr49f_sequence ?? 0) >= 1)
            .sort((a, b) => (a.cr49f_sequence ?? 0) - (b.cr49f_sequence ?? 0));

          const currentSeq = t.cr49f_sequence ?? 1;
          const priorSiblings = sequentialSiblings.filter((s) => (s.cr49f_sequence ?? 0) < currentSeq);
          const allPriorApproved = priorSiblings.every((s) => {
            const sStatus = getTaskApprovalStatusLabel(s);
            return sStatus === "Approved" || Boolean(s.cr49f_approvedby && s.cr49f_approvedon);
          });

          if (!allPriorApproved) {
            // A prior sequential task has not been approved yet, so this task must wait
            isActive = false;
            if (taskId && typeof window !== "undefined") {
              localStorage.setItem(`task_active_${taskId}`, "false");
            }
          } else {
            // All prior sequential tasks are approved (or this is Sequence 1)
            // Task is ACTIVE if backend record is active OR prior tasks are approved
            if (isRecordActive || allPriorApproved || localActive === "true") {
              isActive = true;
              if (taskId && typeof window !== "undefined") {
                localStorage.setItem(`task_active_${taskId}`, "true");
              }
            } else {
              isActive = false;
            }
          }
        }

        let taskType: WorkQueueItem["taskType"] = "Purchase Request";
        let title = t.cr49f_task || `Task #${t.cr49f_sequence || idx + 1}`;
        let priority: "Low" | "Normal" | "High" = "Normal";

        const targetUrl = `/tasks/${taskId}`;

        const isRfq =
          Boolean(rfqId) ||
          t.cr49f_object === 2 ||
          Boolean(
            t.cr49f_task &&
              (t.cr49f_task.toLowerCase().includes("rfq") ||
                t.cr49f_task.toLowerCase().includes("quotation"))
          );

        const parentRfq = rfqId
          ? rfqs.find((r) => cleanGuid(r.cr49f_requestforqoutationid) === rfqId)
          : null;

        if (isRfq) {
          taskType = "Request for Quotation";
          const rfqNum =
            parentRfq?.cr49f_rfqnumber ||
            (rfqId ? rfqId.slice(0, 8) : `RFQ-${1000 + idx}`);
          const rfqTitle = parentRfq?.cr49f_rfqtitle ? ` ${parentRfq.cr49f_rfqtitle}` : "";
          const taskName = t.cr49f_task ? ` (${t.cr49f_task})` : "";
          title = `RFQ Approval - ${rfqNum}${rfqTitle}${taskName}`;
        } else if (poId || t.cr49f_object === 3) {
          taskType = "Purchase Order";
          const taskName = t.cr49f_task ? ` (${t.cr49f_task})` : "";
          title = `Purchase Order Approval - ${taskName}`;
          priority = "High";
        } else if (prId || t.cr49f_object === 1) {
          taskType = "Purchase Request";
          const pr = prs.find(
            (p) => cleanGuid(p.cr49f_purchaserequestid) === prId
          );
          const prNum =
            pr?.cr49f_prnumber ||
            (prId ? prId.slice(0, 8) : `PR-${1000 + idx}`);
          const prTitle = pr?.cr49f_prtitle ? ` ${pr.cr49f_prtitle}` : "";
          const taskName = t.cr49f_task ? ` (${t.cr49f_task})` : "";
          title = `Purchase Request Approval - ${prNum}${prTitle}${taskName}`;
          if (
            pr?.cr49f_priority === 2 ||
            (pr?.cr49f_totalamount && Number(pr.cr49f_totalamount) > 100000)
          ) {
            priority = "High";
          }
        }

        const rawDateStr =
          (t.createdon as string | undefined) ||
          (raw.createdon as string | undefined) ||
          (raw.CreatedOn as string | undefined) ||
          (t.overriddencreatedon as string | undefined) ||
          (raw.overriddencreatedon as string | undefined) ||
          (parentPR as any)?.createdon ||
          (parentPR as any)?.CreatedOn ||
          (parentRfq as any)?.createdon ||
          (parentRfq as any)?.CreatedOn;

        const createdDate = rawDateStr ? new Date(rawDateStr) : null;
        const isValidDate = Boolean(createdDate && !Number.isNaN(createdDate.getTime()));
        const createdOnTime = isValidDate ? (createdDate as Date).getTime() : 0;

        const assignedOn = isValidDate
          ? `${(createdDate as Date).getMonth() + 1}/${(createdDate as Date).getDate()}/${(createdDate as Date).getFullYear()}`
          : "Today";

        return {
          id: cleanGuid(t.cr49f_approvaltasksid) || String(idx),
          taskName: title,
          taskType,
          assignedTo: "Procurement Approver",
          assignedOn,
          priority,
          status: statusLabel,
          isActive,
          targetUrl,
          sequence: t.cr49f_sequence,
          createdOnTime,
          rawCreatedDate: rawDateStr,
        };
      });

      setDataverseTasks(mapped);
    } catch (e) {
      console.warn("Failed to load approval tasks from Dataverse:", e);
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => {
    void fetchTasks();

    const handleUpdate = () => void fetchTasks();
    window.addEventListener("focus", handleUpdate);
    window.addEventListener("approvalTasksUpdated", handleUpdate);
    return () => {
      window.removeEventListener("focus", handleUpdate);
      window.removeEventListener("approvalTasksUpdated", handleUpdate);
    };
  }, [fetchTasks]);

  // STRICT FILTER:
  // Show ONLY approval tasks which are active AND pending or changes needed.
  // Completed, approved, rejected, and future-inactive sequential tasks are excluded.
  const activeTasks = useMemo(() => {
    const source =
      dataverseTasks.length > 0 || hasLoaded
        ? dataverseTasks
        : taskInboxItems.map((task): WorkQueueItem => {
            const parsed = task.assignedOn ? new Date(task.assignedOn).getTime() : 0;
            return {
              id: `sample-${task.id}`,
              taskName: task.taskName,
              taskType: task.taskType as WorkQueueItem["taskType"],
              assignedTo: task.assignedTo,
              assignedOn: task.assignedOn,
              description: task.description,
              priority: task.priority ?? "Normal",
              status: "Pending" as const,
              isActive: true,
              targetUrl: `/tasks/${task.id}`,
              createdOnTime: Number.isNaN(parsed) ? 0 : parsed,
              rawCreatedDate: task.assignedOn,
            };
          });

    return source
      .filter(
        (task) => task.isActive && (task.status === "Pending" || task.status === "Changes Needed")
      )
      .sort((a, b) => (b.createdOnTime || 0) - (a.createdOnTime || 0));
  }, [dataverseTasks, hasLoaded]);

  // Tab counts for active tasks
  const typeCounts = useMemo(() => {
    const counts = {
      ALL: activeTasks.length,
      PR: 0,
      RFQ: 0,
      PO: 0,
    };
    for (const t of activeTasks) {
      if (t.taskType === "Purchase Request") counts.PR++;
      else if (t.taskType === "Request for Quotation") counts.RFQ++;
      else if (t.taskType === "Purchase Order") counts.PO++;
    }
    return counts;
  }, [activeTasks]);

  // Filtered active tasks based on user selections
  const filteredTasks = useMemo(() => {
    const list = activeTasks.filter((task) => {
      // 1. Type filter
      if (typeFilter === "PR" && task.taskType !== "Purchase Request") return false;
      if (typeFilter === "RFQ" && task.taskType !== "Request for Quotation") return false;
      if (typeFilter === "PO" && task.taskType !== "Purchase Order") return false;

      // 2. Status filter
      if (statusFilter === "CHANGES_NEEDED" && task.status !== "Changes Needed") return false;
      if (statusFilter === "PENDING" && task.status !== "Pending") return false;

      // 3. Priority filter
      if (
        priorityFilter !== "ALL" &&
        (task.priority || "Normal").toLowerCase() !== priorityFilter.toLowerCase()
      ) {
        return false;
      }

      // 4. Search text filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = task.taskName.toLowerCase().includes(q);
        const matchType = task.taskType.toLowerCase().includes(q);
        const matchAssignee = task.assignedTo.toLowerCase().includes(q);
        const matchDesc = task.description ? task.description.toLowerCase().includes(q) : false;
        if (!matchName && !matchType && !matchAssignee && !matchDesc) {
          return false;
        }
      }

      return true;
    });

    return [...list].sort((a, b) => {
      const timeA = a.createdOnTime ?? 0;
      const timeB = b.createdOnTime ?? 0;
      if (timeA !== timeB) {
        return sortOrder === "oldest" ? timeA - timeB : timeB - timeA;
      }
      const seqA = a.sequence ?? 0;
      const seqB = b.sequence ?? 0;
      if (seqA !== seqB) return seqA - seqB;
      return a.taskName.localeCompare(b.taskName);
    });
  }, [activeTasks, typeFilter, statusFilter, priorityFilter, searchQuery, sortOrder]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    typeFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    sortOrder !== "newest";

  const handleResetFilters = () => {
    setSearchQuery("");
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
    setSortOrder("newest");
    setPage(1);
  };

  const pages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));
  const start = filteredTasks.length ? (page - 1) * PAGE_SIZE : 0;
  const shown = filteredTasks.slice(start, start + PAGE_SIZE);

  // Automatically reset to last valid page if total count changes
  useEffect(() => {
    if (page > pages) {
      setPage(pages);
    }
  }, [page, pages]);

  const taskIcon = (taskType: string) =>
    taskType === "Invoice" ? (
      <ReceiptText size={14} />
    ) : taskType === "Purchase Order" ? (
      <ClipboardCheck size={14} />
    ) : taskType === "Request for Quotation" ? (
      <ScrollText size={14} />
    ) : (
      <FileText size={14} />
    );

  const handleReview = (task: WorkQueueItem) => {
    if (task.targetUrl) {
      navigate(task.targetUrl);
    } else {
      navigate(`/tasks/${task.id}`);
    }
  };

  return (
    <section className="xt work-queue">
      <header className="work-queue-heading">
        <div>
          <span className="cc-eyebrow">WORK QUEUE</span>
          <h2>My Procurement Tasks</h2>
        </div>
        <div className="work-queue-header-right">
          <span className="work-queue-total">
            {hasActiveFilters
              ? `Showing ${filteredTasks.length} of ${activeTasks.length} active tasks`
              : `${activeTasks.length} ${activeTasks.length === 1 ? "task" : "tasks"} active`}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              className="work-queue-reset-btn"
              onClick={handleResetFilters}
              title="Reset all filters"
            >
              <RotateCcw size={11} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </header>

      {/* Tabs for quick filtering by task type */}
      <div className="work-queue-tabs">
        <button
          type="button"
          className={typeFilter === "ALL" ? "active" : ""}
          onClick={() => {
            setTypeFilter("ALL");
            setPage(1);
          }}
        >
          All <span>({typeCounts.ALL})</span>
        </button>
        <button
          type="button"
          className={typeFilter === "PR" ? "active" : ""}
          onClick={() => {
            setTypeFilter("PR");
            setPage(1);
          }}
        >
          Purchase Requests <span>({typeCounts.PR})</span>
        </button>
        <button
          type="button"
          className={typeFilter === "RFQ" ? "active" : ""}
          onClick={() => {
            setTypeFilter("RFQ");
            setPage(1);
          }}
        >
          RFQs <span>({typeCounts.RFQ})</span>
        </button>
        <button
          type="button"
          className={typeFilter === "PO" ? "active" : ""}
          onClick={() => {
            setTypeFilter("PO");
            setPage(1);
          }}
        >
          Purchase Orders <span>({typeCounts.PO})</span>
        </button>
      </div>

      {/* Interactive Filter Bar */}
      <div className="work-queue-filter-bar">
        <div className="work-queue-search-box">
          <Search size={13} className="work-queue-search-icon" />
          <input
            type="text"
            className="work-queue-search-input"
            placeholder="Search active tasks by title, number, or keyword..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
          />
          {searchQuery && (
            <button
              type="button"
              className="work-queue-search-clear"
              onClick={() => {
                setSearchQuery("");
                setPage(1);
              }}
              title="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="work-queue-filter-selects">
          <select
            className="work-queue-select"
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(e.target.value as "newest" | "oldest");
              setPage(1);
            }}
            aria-label="Sort by Created Date"
            title="Sort tasks by created date"
          >
            <option value="newest">Created Date: Newest First</option>
            <option value="oldest">Created Date: Oldest First</option>
          </select>

          <select
            className="work-queue-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by Status"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Approval</option>
            <option value="CHANGES_NEEDED">Changes Needed</option>
          </select>

          <select
            className="work-queue-select"
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by Priority"
          >
            <option value="ALL">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="normal">Normal Priority</option>
            <option value="low">Low Priority</option>
          </select>
        </div>
      </div>

      {/* Work Queue Task Rows */}
      <div className="work-queue-list">
        {isLoading && !hasLoaded ? (
          <div className="work-queue-empty">
            <span>Loading active approval tasks...</span>
          </div>
        ) : shown.length ? (
          shown.map((task) => (
            <article
              className={`work-queue-row ${task.status === "Changes Needed" ? "is-changes-needed" : ""}`}
              key={task.id}
            >
              <span className={`work-queue-task-icon ${badge(task.taskType)}`}>
                {taskIcon(task.taskType)}
              </span>
              <div className="work-queue-task-copy">
                <button
                  type="button"
                  className="work-queue-task-link"
                  title={task.taskName}
                  onClick={() => handleReview(task)}
                >
                  {task.taskName}
                </button>
                <div className="work-queue-task-meta">
                  <span>{task.taskType}</span>
                  <span>
                    <CalendarDays size={11} /> Created {task.assignedOn}
                  </span>
                </div>
              </div>

              {task.status === "Changes Needed" ? (
                <span
                  className="work-queue-badge changes-needed"
                  title="Action required: revisions requested by approver"
                >
                  Changes Needed
                </span>
              ) : (
                <span
                  className={`work-queue-priority ${
                    task.priority?.toLowerCase() ?? "normal"
                  }`}
                >
                  {task.priority ?? "Normal"}
                </span>
              )}

              <button
                className="work-queue-review"
                type="button"
                onClick={() => handleReview(task)}
              >
                Review <ArrowUpRight size={12} />
              </button>
            </article>
          ))
        ) : (
          <div className="work-queue-empty">
            {hasActiveFilters ? (
              <div>
                <p>No active tasks match your selected filters.</p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  style={{
                    marginTop: 8,
                    background: "none",
                    border: "none",
                    color: "var(--primary-hex, #2563eb)",
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <span>No pending approval tasks in queue. All active tasks have been completed.</span>
            )}
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      <footer className="xt-foot work-queue-footer">
        <span>Assigned date shown; displaying active tasks only.</span>
        <button
          type="button"
          aria-label="Previous page"
          disabled={page === 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          <ChevronLeft size={14} />
        </button>
        <span>
          {filteredTasks.length ? start + 1 : 0}–
          {Math.min(start + PAGE_SIZE, filteredTasks.length)} of {filteredTasks.length}
        </span>
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => setPage((current) => Math.min(pages, current + 1))}
        >
          <ChevronRight size={14} />
        </button>
      </footer>
    </section>
  );
};

export default TaskInbox;
