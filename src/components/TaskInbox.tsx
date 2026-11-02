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
  ScrollText,
} from "lucide-react";
import { taskInboxItems } from "../data/tasks";
import { Cr49f_approvaltasksesService } from "../generated/services/Cr49f_approvaltasksesService";
import { Cr49f_purchaserequestsService } from "../generated/services/Cr49f_purchaserequestsService";
import { Cr49f_requestforqoutationsService } from "../generated/services/Cr49f_requestforqoutationsService";
import {
  getTaskApprovalStatusLabel,
  cleanGuid,
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
  status: "Pending" | "Approved" | "Rejected";
  isActive: boolean;
  targetUrl: string;
  sequence?: number;
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

      const mapped: WorkQueueItem[] = rawTasks.map((t, idx) => {
        const raw = t as unknown as Record<string, unknown>;
        const prId =
          cleanGuid(t._cr49f_pr_value) ||
          cleanGuid(raw._cr49f_PR_value as string) ||
          cleanGuid(raw.cr49f_pr as string);
        const rfqId =
          cleanGuid(t._cr49f_rfq_value) ||
          cleanGuid(raw._cr49f_RFQ_value as string) ||
          cleanGuid(raw.cr49f_rfq as string);
        const poId =
          cleanGuid(t._cr49f_po_value) ||
          cleanGuid(raw._cr49f_PO_value as string) ||
          cleanGuid(raw.cr49f_po as string);

        const statusLabel = getTaskApprovalStatusLabel(t);
        const isActive =
          (t.statecode === 0 || t.statecode === undefined || Number(t.statecode) === 0) &&
          Number(t.statuscode ?? 1) !== 2;

        let taskType: WorkQueueItem["taskType"] = "Purchase Request";
        let title = t.cr49f_task || `Task #${t.cr49f_sequence || idx + 1}`;
        let priority: "Low" | "Normal" | "High" = "Normal";

        const taskId = cleanGuid(t.cr49f_approvaltasksid) || String(idx);
        const targetUrl = `/tasks/${taskId}`;

        if (prId || t.cr49f_object === 1) {
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
        } else if (rfqId || t.cr49f_object === 2) {
          taskType = "Request for Quotation";
          const rfq = rfqs.find(
            (r) => cleanGuid(r.cr49f_requestforqoutationid) === rfqId
          );
          const rfqNum =
            rfq?.cr49f_rfqnumber ||
            (rfqId ? rfqId.slice(0, 8) : `RFQ-${1000 + idx}`);
          const taskName = t.cr49f_task ? ` (${t.cr49f_task})` : "";
          title = `RFQ Approval - ${rfqNum}${taskName}`;
        } else if (poId || t.cr49f_object === 3) {
          taskType = "Purchase Order";
          const taskName = t.cr49f_task ? ` (${t.cr49f_task})` : "";
          title = `Purchase Order Approval - ${taskName}`;
          priority = "High";
        }

        const createdDate = t.createdon ? new Date(t.createdon) : new Date();
        const assignedOn = !Number.isNaN(createdDate.getTime())
          ? `${createdDate.getMonth() + 1}/${createdDate.getDate()}/${createdDate.getFullYear()}`
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
  // Show only approval tasks which are active (statecode === 0) AND pending.
  // If a task gets approved or rejected, or is inactive, it will NOT be shown.
  const activePendingTasks = useMemo(() => {
    const source =
      dataverseTasks.length > 0 || hasLoaded
        ? dataverseTasks
        : taskInboxItems.map((task): WorkQueueItem => ({
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
          }));

    return source.filter((task) => task.isActive && task.status === "Pending");
  }, [dataverseTasks, hasLoaded]);

  const pages = Math.max(1, Math.ceil(activePendingTasks.length / PAGE_SIZE));
  const start = activePendingTasks.length ? (page - 1) * PAGE_SIZE : 0;
  const shown = activePendingTasks.slice(start, start + PAGE_SIZE);

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
        <span className="work-queue-total">
          {activePendingTasks.length} {activePendingTasks.length === 1 ? "task" : "tasks"} pending
        </span>
      </header>

      <div className="work-queue-list">
        {isLoading && !hasLoaded ? (
          <div className="work-queue-empty">
            <span>Loading pending approval tasks...</span>
          </div>
        ) : shown.length ? (
          shown.map((task) => (
            <article className="work-queue-row" key={task.id}>
              <span
                className={`work-queue-task-icon ${badge(task.taskType)}`}
              >
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
                    <CalendarDays size={11} /> Assigned {task.assignedOn}
                  </span>
                </div>
              </div>
              <span
                className={`work-queue-priority ${
                  task.priority?.toLowerCase() ?? "normal"
                }`}
              >
                {task.priority ?? "Normal"}
              </span>
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
            <span>No pending approval tasks. All tasks have been completed.</span>
          </div>
        )}
      </div>

      <footer className="xt-foot work-queue-footer">
        <span>Assigned date shown; due dates are not available.</span>
        <button
          type="button"
          aria-label="Previous page"
          disabled={page === 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          <ChevronLeft size={14} />
        </button>
        <span>
          {activePendingTasks.length ? start + 1 : 0}–
          {Math.min(start + PAGE_SIZE, activePendingTasks.length)} of {activePendingTasks.length}
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
