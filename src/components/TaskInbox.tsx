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
type Tab = "Needs Action" | "Approvals" | "Contracts" | "Invoices" | "Completed";

const tabs: Tab[] = [
  "Needs Action",
  "Approvals",
  "Contracts",
  "Invoices",
  "Completed",
];

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
  const [tab, setTab] = useState<Tab>("Needs Action");
  const [page, setPage] = useState(1);
  const [dataverseTasks, setDataverseTasks] = useState<WorkQueueItem[]>([]);
  const [, setIsLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
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
        const isActive = t.statecode === 0;

        let taskType: WorkQueueItem["taskType"] = "Purchase Request";
        let title = t.cr49f_task || `Task #${t.cr49f_sequence || idx + 1}`;
        let targetUrl = "/";
        let priority: "Low" | "Normal" | "High" = "Normal";

        const taskId = cleanGuid(t.cr49f_approvaltasksid) || String(idx);
        targetUrl = `/tasks/${taskId}`;

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

  const allTasks = useMemo(() => {
    if (dataverseTasks.length > 0) {
      // 100% Dynamic tasks from Dataverse table cr49f_approvaltasks
      return dataverseTasks;
    }

    // Fallback placeholder if no tasks in Dataverse yet
    return taskInboxItems.map((task): WorkQueueItem => ({
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
  }, [dataverseTasks]);

  const rows = useMemo(() => {
    return allTasks.filter((task) => {
      if (tab === "Needs Action") {
        return task.isActive && task.status === "Pending";
      }
      if (tab === "Approvals") {
        return (
          (task.taskType === "Purchase Request" ||
            task.taskType === "Request for Quotation" ||
            task.taskType === "Purchase Order") &&
          task.status === "Pending"
        );
      }
      if (tab === "Invoices") {
        return task.taskType === "Invoice" && task.status === "Pending";
      }
      if (tab === "Contracts") {
        return task.taskType === "Contract" && task.status === "Pending";
      }
      if (tab === "Completed") {
        return task.status === "Approved";
      }
      return true;
    });
  }, [allTasks, tab]);

  const countForTab = (target: Tab) => {
    return allTasks.filter((task) => {
      if (target === "Needs Action") {
        return task.isActive && task.status === "Pending";
      }
      if (target === "Approvals") {
        return (
          (task.taskType === "Purchase Request" ||
            task.taskType === "Request for Quotation" ||
            task.taskType === "Purchase Order") &&
          task.status === "Pending"
        );
      }
      if (target === "Invoices") {
        return task.taskType === "Invoice" && task.status === "Pending";
      }
      if (target === "Contracts") {
        return task.taskType === "Contract" && task.status === "Pending";
      }
      if (target === "Completed") {
        return task.status === "Approved";
      }
      return true;
    }).length;
  };

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const start = rows.length ? (page - 1) * PAGE_SIZE : 0;
  const shown = rows.slice(start, start + PAGE_SIZE);

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
        <span className="work-queue-total">{countForTab("Needs Action")} open</span>
      </header>

      <nav className="work-queue-tabs" aria-label="Task categories">
        {tabs.map((item) => (
          <button
            type="button"
            key={item}
            className={tab === item ? "active" : ""}
            aria-pressed={tab === item}
            onClick={() => {
              setTab(item);
              setPage(1);
            }}
          >
            {item}
            <span>{countForTab(item)}</span>
          </button>
        ))}
      </nav>

      <div className="work-queue-list">
        {shown.length ? (
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
            <span>
              {tab === "Completed"
                ? "No completed tasks yet. Approved tasks will appear here."
                : tab === "Contracts"
                ? "No contract signatory tasks are currently listed."
                : tab === "Invoices"
                ? "No invoice approval tasks are currently listed."
                : "No tasks in this view."}
            </span>
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
          {rows.length ? start + 1 : 0}–
          {Math.min(start + PAGE_SIZE, rows.length)} of {rows.length}
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
