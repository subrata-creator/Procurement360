import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ClipboardList,
  Clock,
  ExternalLink,
  FileText,
  Flag,
  List,
  Loader2,
  Send,
  ShieldCheck,
  Tag,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  XCircle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { getTaskById } from "../data/tasks";
import type { Task } from "../types/dashboard";
import { Cr49f_approvaltasksesService } from "../generated/services/Cr49f_approvaltasksesService";
import { Cr49f_purchaserequestsService } from "../generated/services/Cr49f_purchaserequestsService";
import { Cr49f_purchaserequestlinesService } from "../generated/services/Cr49f_purchaserequestlinesService";
import { Cr49f_requestforqoutationsService } from "../generated/services/Cr49f_requestforqoutationsService";
import type { Cr49f_approvaltaskses } from "../generated/models/Cr49f_approvaltasksesModel";
import {
  Cr49f_approvaltasksescr49f_department,
  Cr49f_approvaltasksescr49f_role,
  Cr49f_approvaltasksescr49f_slaunit,
} from "../generated/models/Cr49f_approvaltasksesModel";
import type { Cr49f_purchaserequests } from "../generated/models/Cr49f_purchaserequestsModel";
import type { Cr49f_purchaserequestlines } from "../generated/models/Cr49f_purchaserequestlinesModel";
import type { Cr49f_requestforqoutations } from "../generated/models/Cr49f_requestforqoutationsModel";
import {
  cleanGuid,
  getTaskApprovalStatusLabel,
  approveTask,
  rejectTask,
  getApprovalTasksForRecord,
} from "../Services/ApprovalWorkflowService";
import "../Styles/TaskDetail.css";

function toUsDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

interface TaskComment {
  id: string;
  text: string;
  author: string;
  timestamp: string;
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [dataverseTask, setDataverseTask] = useState<Cr49f_approvaltaskses | null>(null);
  const [parentPR, setParentPR] = useState<Cr49f_purchaserequests | null>(null);
  const [parentRFQ, setParentRFQ] = useState<Cr49f_requestforqoutations | null>(null);
  const [lineItems, setLineItems] = useState<Cr49f_purchaserequestlines[]>([]);
  const [siblingTasks, setSiblingTasks] = useState<Cr49f_approvaltaskses[]>([]);

  const loadDataverseTaskData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const cleanTargetId = cleanGuid(id);
      const res = await Cr49f_approvaltasksesService.getAll();
      const allTasks = res.data ?? [];

      const matched = allTasks.find((t) => {
        const raw = t as unknown as Record<string, unknown>;
        return (
          cleanGuid(t.cr49f_approvaltasksid) === cleanTargetId ||
          t.cr49f_id === id ||
          cleanGuid(raw.cr49f_approvaltasksid as string) === cleanTargetId
        );
      });

      if (matched) {
        setDataverseTask(matched);

        const rawMatched = matched as unknown as Record<string, unknown>;
        const prId =
          cleanGuid(matched._cr49f_pr_value) ||
          cleanGuid(rawMatched._cr49f_PR_value as string) ||
          cleanGuid(rawMatched.cr49f_pr as string);

        const rfqId =
          cleanGuid(matched._cr49f_rfq_value) ||
          cleanGuid(rawMatched._cr49f_RFQ_value as string) ||
          cleanGuid(rawMatched.cr49f_rfq as string);

        if (prId || matched.cr49f_object === 1) {
          const [prsRes, linesRes, siblings] = await Promise.all([
            Cr49f_purchaserequestsService.getAll(),
            Cr49f_purchaserequestlinesService.getAll(),
            getApprovalTasksForRecord(1, prId || ""),
          ]);

          const foundPR = (prsRes.data ?? []).find(
            (p) => cleanGuid(p.cr49f_purchaserequestid) === prId
          );
          setParentPR(foundPR || null);

          const matchedLines = (linesRes.data ?? []).filter((l) => {
            const rawL = l as unknown as Record<string, unknown>;
            const lPR =
              cleanGuid(l._cr49f_purchaserequest_value) ||
              cleanGuid(rawL._cr49f_PurchaseRequest_value as string);
            return lPR === prId;
          });
          setLineItems(matchedLines);
          setSiblingTasks(siblings);
        } else if (rfqId || matched.cr49f_object === 2) {
          const [rfqsRes, siblings] = await Promise.all([
            Cr49f_requestforqoutationsService.getAll(),
            getApprovalTasksForRecord(2, rfqId || ""),
          ]);

          const foundRFQ = (rfqsRes.data ?? []).find(
            (r) => cleanGuid(r.cr49f_requestforqoutationid) === rfqId
          );
          setParentRFQ(foundRFQ || null);
          setSiblingTasks(siblings);
        }
      }
    } catch (err) {
      console.warn("Failed to load Dataverse approval task:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadDataverseTaskData();

    const handleUpdate = () => void loadDataverseTaskData();
    window.addEventListener("approvalTasksUpdated", handleUpdate);
    return () => {
      window.removeEventListener("approvalTasksUpdated", handleUpdate);
    };
  }, [loadDataverseTaskData]);

  if (loading) {
    return (
      <section className="task-page-container" style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <div style={{ textAlign: "center", color: "var(--muted-foreground-hex, #64748b)" }}>
          <Loader2 size={36} className="animate-spin" style={{ margin: "0 auto 12px", display: "block", color: "var(--primary-hex, #2563eb)" }} />
          <p style={{ fontSize: 14, fontWeight: 500 }}>Loading approval task details...</p>
        </div>
      </section>
    );
  }

  // 1. Dataverse Task Found
  if (dataverseTask) {
    return (
      <ModernDataverseTaskDetail
        task={dataverseTask}
        parentPR={parentPR}
        parentRFQ={parentRFQ}
        lineItems={lineItems}
        siblingTasks={siblingTasks}
        onRefresh={loadDataverseTaskData}
        onBack={() => navigate(-1)}
      />
    );
  }

  // 2. Legacy / Sample Task Fallback
  const numericId = Number(id?.replace("sample-", ""));
  const sampleTask = !Number.isNaN(numericId) ? getTaskById(numericId) : undefined;

  if (sampleTask) {
    if (sampleTask.taskType === "Request for Quotation") {
      return <RfqApprovalTask task={sampleTask} onBack={() => navigate(-1)} />;
    }
    return <OtherApprovalTask task={sampleTask} onBack={() => navigate(-1)} />;
  }

  // 3. Not Found
  return (
    <section className="task-page-container">
      <button type="button" className="task-back-btn" onClick={() => navigate("/")}>
        <ArrowLeft size={16} /> Dashboard
      </button>
      <div style={{ margin: "60px auto", textAlign: "center", maxWidth: 440 }}>
        <AlertCircle size={40} style={{ color: "#ef4444", margin: "0 auto 14px", display: "block" }} />
        <h2 style={{ fontSize: 18, color: "var(--foreground-hex, #0f172a)", marginBottom: 8, fontWeight: 700 }}>Task Not Found</h2>
        <p style={{ fontSize: 13, color: "var(--muted-foreground-hex, #64748b)", marginBottom: 20, lineHeight: 1.5 }}>
          Could not find an approval task matching &quot;{id}&quot; in the approval tasks table.
        </p>
        <button
          type="button"
          onClick={() => navigate("/")}
          style={{
            padding: "9px 20px",
            background: "var(--primary-hex, #2563eb)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Return to Dashboard
        </button>
      </div>
    </section>
  );
}

/**
 * Modern, High-End Enterprise Task Review View
 * Pure task focus without PR Journey card.
 */
function ModernDataverseTaskDetail({
  task,
  parentPR,
  parentRFQ,
  lineItems,
  siblingTasks,
  onRefresh,
  onBack,
}: {
  task: Cr49f_approvaltaskses;
  parentPR: Cr49f_purchaserequests | null;
  parentRFQ: Cr49f_requestforqoutations | null;
  lineItems: Cr49f_purchaserequestlines[];
  siblingTasks: Cr49f_approvaltaskses[];
  onRefresh: () => Promise<void>;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const cleanTaskId = cleanGuid(task.cr49f_approvaltasksid);
  const approvalStatus = getTaskApprovalStatusLabel(task);
  const isApproved = approvalStatus === "Approved";
  const isRejected = approvalStatus === "Rejected";
  const isPending = approvalStatus === "Pending";
  const isActive = task.statecode === 0 && isPending;

  // Comments state persisted in localStorage
  const commentsKey = `task_comments_${cleanTaskId}`;
  const [comments, setComments] = useState<TaskComment[]>(() => {
    try {
      const stored = window.localStorage.getItem(commentsKey);
      if (stored) return JSON.parse(stored) as TaskComment[];
    } catch {
      // Fallback
    }
    return [];
  });
  const [commentDraft, setCommentDraft] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const addComment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = commentDraft.trim();
    if (!text) return;

    const newComment: TaskComment = {
      id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text,
      author: "Procurement Approver",
      timestamp: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    };

    const updated = [...comments, newComment];
    setComments(updated);
    try {
      window.localStorage.setItem(commentsKey, JSON.stringify(updated));
    } catch {
      // Keep in local state
    }
    setCommentDraft("");
    setNotice("Comment added successfully.");
  };

  const handleApprove = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setNotice(null);
    try {
      const result = await approveTask(cleanTaskId);
      setNotice(
        result.parentCompleted
          ? "Final approval complete! All sequential cycle tasks are approved and the record is Approved."
          : `Task approved successfully! Sequence #${result.nextActivatedTask?.cr49f_sequence ?? 2} has been activated.`
      );
      await onRefresh();
    } catch (err: unknown) {
      console.error("Failed to approve task:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      setNotice(`Failed to approve task: ${msg}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setNotice(null);
    try {
      await rejectTask(cleanTaskId);
      setNotice("Task has been rejected. Parent procurement request has been marked as Rejected.");
      await onRefresh();
    } catch (err: unknown) {
      console.error("Failed to reject task:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      setNotice(`Failed to reject task: ${msg}`);
    } finally {
      setActionLoading(false);
    }
  };

  const isPr = task.cr49f_object === 1 || !!parentPR;
  const isRfq = task.cr49f_object === 2 || !!parentRFQ;

  const reference = isPr
    ? parentPR?.cr49f_prnumber || "PR-2026"
    : isRfq
    ? parentRFQ?.cr49f_rfqnumber || "RFQ-2026"
    : `TASK-${task.cr49f_sequence || 1}`;

  const recordTitle = isPr
    ? parentPR?.cr49f_prtitle || "Purchase Request"
    : isRfq
    ? parentRFQ?.cr49f_rfqtitle || "Request for Quotation"
    : task.cr49f_task || "Approval Task";

  const requesterName = isPr
    ? parentPR?.createdbyname || "Sakshi Paliwal"
    : isRfq
    ? parentRFQ?.createdbyname || "Neha Sharma"
    : "Business User";

  const deptLabel = task.cr49f_department
    ? (Cr49f_approvaltasksescr49f_department[task.cr49f_department] || "IT")
    : "Information Technology";

  const roleLabel = task.cr49f_role
    ? (Cr49f_approvaltasksescr49f_role[task.cr49f_role] || "Procurement Approver")
    : "Procurement Approver";

  const slaUnitLabel = task.cr49f_slaunit
    ? (Cr49f_approvaltasksescr49f_slaunit[task.cr49f_slaunit] || "Hours")
    : "Hours";

  const slaLabel = `${task.cr49f_slanumber ?? 24} ${slaUnitLabel}`;

  const priorityLabel = isPr
    ? parentPR?.cr49f_priority === 2
      ? "High"
      : parentPR?.cr49f_priority === 0
      ? "Low"
      : "Medium"
    : "Medium";

  // Stepper steps from siblingTasks
  const displaySteps = siblingTasks.length > 0 ? siblingTasks : [task];

  return (
    <section className="task-page-container">
      {/* 1. Header Navigation & Title Section */}
      <header className="task-page-header">
        <div className="task-nav-row">
          <button type="button" className="task-back-btn" onClick={onBack}>
            <ArrowLeft size={14} /> Back to Tasks
          </button>
          <div className="task-breadcrumb-nav">
            <span>Work Queue</span>
            <span className="separator">/</span>
            {parentPR ? (
              <Link to={`/purchase-requests/${parentPR.cr49f_prnumber || parentPR.cr49f_purchaserequestid}`}>
                {parentPR.cr49f_prnumber}
              </Link>
            ) : (
              <span>{reference}</span>
            )}
            <span className="separator">/</span>
            <span>Task #{task.cr49f_sequence ?? 1}</span>
          </div>
        </div>

        <div className="task-header-main">
          <div className="task-title-group">
            <div className="task-badge-row">
              <span className="task-eyebrow-pill">
                <ShieldCheck size={11} />
                {isPr ? "Purchase Request Approval" : isRfq ? "RFQ Approval" : "Approval Task"}
              </span>
              <span className="task-seq-pill">
                Step {task.cr49f_sequence ?? 1} of {displaySteps.length}
              </span>
              <span className={`task-status-pill ${isApproved ? "approved" : isRejected ? "rejected" : isActive ? "active" : "pending"}`}>
                <span className="dot" />
                {isApproved
                  ? "Approved"
                  : isRejected
                  ? "Rejected"
                  : isActive
                  ? "Action Required"
                  : "Inactive (Waiting in Sequence)"}
              </span>
            </div>

            <h1>{task.cr49f_task || "Approval Task"}</h1>

            <div className="task-subtitle-row">
              <span>Related to <strong>{reference}</strong>: {recordTitle}</span>
              {parentPR && (
                <Link to={`/purchase-requests/${parentPR.cr49f_prnumber || parentPR.cr49f_purchaserequestid}`}>
                  Open Full PR Summary <ExternalLink size={12} />
                </Link>
              )}
            </div>
          </div>

          <div className="task-header-right-actions">
            <div className="task-sla-badge-box">
              <Clock size={16} className="task-sla-icon" />
              <div>
                <span className="task-sla-label">Turnaround SLA</span>
                <strong className="task-sla-value">{slaLabel}</strong>
              </div>
            </div>

            {isActive && (
              <div className="task-header-action-group">
                <button
                  type="button"
                  className="task-btn-reject-header"
                  onClick={() => void handleReject()}
                  disabled={actionLoading}
                >
                  <ThumbsDown size={14} /> Reject
                </button>
                <button
                  type="button"
                  className="task-btn-approve-header"
                  onClick={() => void handleApprove()}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
                  Approve Task
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Feedback Notice */}
      {notice && (
        <div
          style={{
            margin: "0 0 20px",
            padding: "12px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            background: notice.toLowerCase().includes("fail") || notice.toLowerCase().includes("error")
              ? "#fee2e2"
              : "#f0fdf4",
            color: notice.toLowerCase().includes("fail") || notice.toLowerCase().includes("error")
              ? "#991b1b"
              : "#166534",
            border: notice.toLowerCase().includes("fail") || notice.toLowerCase().includes("error")
              ? "1px solid #fecaca"
              : "1px solid #bbf7d0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Sequential Approval Cycle Stepper Card */}
      <section className="task-workflow-card">
        <div className="task-card-header">
          <div className="task-card-header-left">
            <div className="task-card-header-icon green">
              <ShieldCheck size={16} />
            </div>
            <div className="task-card-header-titles">
              <h2>Approval Workflow Sequence</h2>
              <p>Step {task.cr49f_sequence ?? 1} of {displaySteps.length} configured in approval cycle</p>
            </div>
          </div>
          <span
            className={`task-step-badge ${isApproved ? "approved" : isRejected ? "rejected" : isActive ? "active" : "pending"}`}
            style={{ fontSize: 11, padding: "3px 10px" }}
          >
            {isApproved ? "Approved" : isRejected ? "Rejected" : isActive ? "Current Action Step" : "Waiting in Sequence"}
          </span>
        </div>

        <div className="task-workflow-stepper">
          {displaySteps.map((stepItem, index) => {
            const stepStatus = getTaskApprovalStatusLabel(stepItem);
            const stepApproved = stepStatus === "Approved";
            const stepRejected = stepStatus === "Rejected";
            const stepActive = stepItem.statecode === 0 && stepStatus === "Pending";
            const isCurrentViewed = cleanGuid(stepItem.cr49f_approvaltasksid) === cleanTaskId;

            const stepRole = stepItem.cr49f_role
              ? (Cr49f_approvaltasksescr49f_role[stepItem.cr49f_role] || "Approver")
              : "Approver";
            const stepDept = stepItem.cr49f_department
              ? (Cr49f_approvaltasksescr49f_department[stepItem.cr49f_department] || "IT")
              : "IT";

            return (
              <button
                type="button"
                className={`task-step-item ${
                  stepApproved
                    ? "is-approved"
                    : stepRejected
                    ? "is-rejected"
                    : stepActive
                    ? "is-current-active"
                    : ""
                } ${isCurrentViewed ? "is-current" : ""}`}
                key={stepItem.cr49f_approvaltasksid || index}
                onClick={() => {
                  if (stepItem.cr49f_approvaltasksid && !isCurrentViewed) {
                    navigate(`/tasks/${stepItem.cr49f_approvaltasksid}`);
                  }
                }}
                title={`Click to view Task #${stepItem.cr49f_sequence || index + 1}`}
              >
                <div className={`task-step-connector ${stepApproved ? "done" : ""}`} />
                <div className="task-step-node">
                  {stepApproved ? (
                    <Check size={14} />
                  ) : stepRejected ? (
                    <XCircle size={14} />
                  ) : (
                    stepItem.cr49f_sequence || index + 1
                  )}
                </div>

                <div className="task-step-details">
                  <span className="task-step-title">{stepItem.cr49f_task || `Task #${index + 1}`}</span>
                  <span className="task-step-meta">{stepRole} · {stepDept}</span>
                  <span
                    className={`task-step-badge ${
                      stepApproved
                        ? "approved"
                        : stepRejected
                        ? "rejected"
                        : stepActive
                        ? "active"
                        : "pending"
                    }`}
                  >
                    {stepApproved
                      ? "Approved"
                      : stepRejected
                      ? "Rejected"
                      : stepActive
                      ? "Action Needed"
                      : "Pending"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. Two-Column Dashboard Layout */}
      <div className="task-grid-layout">
        {/* Left Column (Primary Request Details, Items, and Comments) */}
        <div className="task-main-col">
          {/* Request Information Metrics Card */}
          <section className="task-card">
            <div className="task-card-header">
              <div className="task-card-header-left">
                <div className="task-card-header-icon">
                  <FileText size={16} />
                </div>
                <div className="task-card-header-titles">
                  <h2>Request Overview</h2>
                  <p>Procurement request details and specifications</p>
                </div>
              </div>
            </div>

            <div className="task-metrics-grid">
              <div className="task-metric-tile highlight">
                <div className="task-metric-icon violet">
                  <Flag size={17} />
                </div>
                <div className="task-metric-info">
                  <span className="task-metric-label">Priority Tier</span>
                  <strong className="task-metric-value large">{priorityLabel}</strong>
                </div>
              </div>

              <div className="task-metric-tile">
                <div className="task-metric-icon blue">
                  <UserRound size={17} />
                </div>
                <div className="task-metric-info">
                  <span className="task-metric-label">Requester</span>
                  <strong className="task-metric-value">{requesterName}</strong>
                </div>
              </div>

              <div className="task-metric-tile">
                <div className="task-metric-icon purple">
                  <List size={17} />
                </div>
                <div className="task-metric-info">
                  <span className="task-metric-label">PR Reference</span>
                  <strong className="task-metric-value">{reference}</strong>
                </div>
              </div>

              <div className="task-metric-tile">
                <div className="task-metric-icon green">
                  <CalendarDays size={17} />
                </div>
                <div className="task-metric-info">
                  <span className="task-metric-label">Required Delivery</span>
                  <strong className="task-metric-value">
                    {toUsDate(parentPR?.cr49f_requireddeliverydate)}
                  </strong>
                </div>
              </div>
            </div>

            {parentPR?.cr49f_businessjustification && (
              <div className="task-justification-box">
                <div className="task-justification-title">
                  <Tag size={12} />
                  Business Need &amp; Justification
                </div>
                <p>{parentPR.cr49f_businessjustification}</p>
              </div>
            )}
          </section>

          {/* Line Items Card */}
          <section className="task-card">
            <div className="task-card-header">
              <div className="task-card-header-left">
                <div className="task-card-header-icon">
                  <List size={16} />
                </div>
                <div className="task-card-header-titles">
                  <h2>Requested Line Items</h2>
                  <p>Itemized equipment and service specifications</p>
                </div>
              </div>
              <span className="task-seq-pill">
                {lineItems.length > 0 ? `${lineItems.length} line items` : "1 item recorded"}
              </span>
            </div>

            <div className="task-table-scroll">
              <table className="task-modern-table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>#</th>
                    <th>Item Name</th>
                    <th>Specification / Description</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.length > 0 ? (
                    lineItems.map((item, index) => {
                      return (
                        <tr key={item.cr49f_purchaserequestlineid || index}>
                          <td><strong>{index + 1}</strong></td>
                          <td>
                            <strong style={{ color: "var(--foreground-hex, #0f172a)" }}>
                              {item.cr49f_itemname || `Item #${index + 1}`}
                            </strong>
                          </td>
                          <td style={{ color: "var(--muted-foreground-hex, #64748b)" }}>
                            {item.cr49f_itemdescription || "—"}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td>1</td>
                      <td><strong>{recordTitle}</strong></td>
                      <td>Procurement equipment / services</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="task-table-footer">
              <span>Showing all requested items</span>
              <span>
                Total Items: <strong>{lineItems.length > 0 ? lineItems.length : 1}</strong>
              </span>
            </div>
          </section>

          {/* Comments & Remarks Card */}
          <section className="task-card">
            <div className="task-card-header">
              <div className="task-card-header-left">
                <div className="task-card-header-icon">
                  <ClipboardList size={16} />
                </div>
                <div className="task-card-header-titles">
                  <h2>Task Comments &amp; Notes</h2>
                  <p>Audit trail of approver remarks and internal communications</p>
                </div>
              </div>
              <span className="task-seq-pill">
                {comments.length} {comments.length === 1 ? "comment" : "comments"}
              </span>
            </div>

            <div className="task-comments-container">
              {comments.length > 0 ? (
                <div className="task-comments-feed">
                  {comments.map((comment) => (
                    <div className="task-comment-item" key={comment.id}>
                      <div className="task-comment-avatar">
                        {comment.author.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="task-comment-bubble">
                        <div className="task-comment-bubble-header">
                          <span className="task-comment-author">{comment.author}</span>
                          <span className="task-comment-time">{comment.timestamp}</span>
                        </div>
                        <p className="task-comment-text">{comment.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="task-empty-comments">
                  No comments yet. Leave an approval remark or note below.
                </div>
              )}

              <form className="task-comment-composer" onSubmit={addComment}>
                <input
                  className="task-comment-input"
                  aria-label="Add remark"
                  placeholder="Type an approver note, comment, or remark..."
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                />
                <button type="submit" className="task-comment-submit-btn">
                  <Send size={14} /> Send
                </button>
              </form>
            </div>
          </section>
        </div>

        {/* Right Column (Task Assignment & Record Context) */}
        <div className="task-side-col">
          {/* Task Assignment Card */}
          <section className="task-card">
            <div className="task-card-header">
              <div className="task-card-header-left">
                <div className="task-card-header-icon green">
                  <ShieldCheck size={16} />
                </div>
                <div className="task-card-header-titles">
                  <h2>Task Assignment</h2>
                  <p>Workflow routing &amp; SLA</p>
                </div>
              </div>
            </div>

            <div className="task-profile-body">
              <div className="task-profile-hero">
                <div className="task-profile-avatar assignee">
                  {roleLabel.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="task-profile-name">{roleLabel}</h3>
                  <p className="task-profile-role">{deptLabel} Department</p>
                </div>
              </div>

              <div className="task-info-list">
                <div className="task-info-row">
                  <span className="label">Sequence Position</span>
                  <strong className="value">Step #{task.cr49f_sequence ?? 1} in Workflow</strong>
                </div>
                <div className="task-info-row">
                  <span className="label">Target SLA</span>
                  <strong className="value">{slaLabel}</strong>
                </div>
                <div className="task-info-row">
                  <span className="label">Workflow State</span>
                  <strong className="value">
                    {task.statecode === 0 ? "Active (In Progress)" : "Inactive (Waiting in sequence)"}
                  </strong>
                </div>
                <div className="task-info-row">
                  <span className="label">Decision Status</span>
                  <strong
                    className="value"
                    style={{ color: isApproved ? "#16a34a" : isRejected ? "#dc2626" : "#2563eb" }}
                  >
                    {approvalStatus}
                  </strong>
                </div>
              </div>
            </div>
          </section>

          {/* Related PR Record Context */}
          {parentPR && (
            <section className="task-card">
              <div className="task-card-header">
                <div className="task-card-header-left">
                  <div className="task-card-header-icon blue">
                    <FileText size={16} />
                  </div>
                  <div className="task-card-header-titles">
                    <h2>Record Context</h2>
                    <p>Purchase request details</p>
                  </div>
                </div>
              </div>

              <div className="task-profile-body">
                <div className="task-info-list">
                  <div className="task-info-row">
                    <span className="label">PR Number</span>
                    <strong className="value">{reference}</strong>
                  </div>
                  <div className="task-info-row">
                    <span className="label">Department</span>
                    <strong className="value">{deptLabel}</strong>
                  </div>
                  <div className="task-info-row">
                    <span className="label">Delivery Location</span>
                    <strong className="value">{parentPR.cr49f_deliverylocation || "Main Office"}</strong>
                  </div>
                  <div className="task-info-row">
                    <span className="label">Priority</span>
                    <strong className="value">{priorityLabel}</strong>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <Link
                    to={`/purchase-requests/${parentPR.cr49f_prnumber || parentPR.cr49f_purchaserequestid}`}
                    className="task-link-button"
                  >
                    <span>View Full PR Summary</span>
                    <ExternalLink size={13} />
                  </Link>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* 5. Sticky Action Footer Bar */}
      <footer className="task-sticky-bar">
        <div className="task-sticky-left">
          <button type="button" className="task-btn-close" onClick={onBack}>
            ← Back
          </button>
          <span style={{ fontSize: 13, color: "var(--foreground-hex, #0f172a)", fontWeight: 600 }}>
            {task.cr49f_task} ({reference})
          </span>
        </div>

        <div className="task-sticky-actions">
          {isApproved ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="task-status-pill approved">
                <CheckCircle2 size={13} /> Task Approved
              </span>
            </div>
          ) : isRejected ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="task-status-pill rejected">
                <XCircle size={13} /> Task Rejected
              </span>
            </div>
          ) : !isActive ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="task-status-pill pending">
                ⏳ Inactive · Waiting for prior sequential task approval
              </span>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="task-btn-reject"
                onClick={() => void handleReject()}
                disabled={actionLoading}
              >
                <ThumbsDown size={14} /> Reject
              </button>

              <button
                type="button"
                className="task-btn-approve"
                onClick={() => void handleApprove()}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
                Approve Task
              </button>
            </>
          )}
        </div>
      </footer>
    </section>
  );
}

// -------------------------------------------------------------
// Legacy Mock Task Components for Fallback
// -------------------------------------------------------------

function RfqApprovalTask({ task, onBack }: { task: Task; onBack: () => void }) {
  const [status, setStatus] = useState("In Review");
  const [assignee, setAssignee] = useState(task.id === 5 ? "Rushi Pardeshi" : "Aman Jain");
  const [notice, setNotice] = useState("");
  const reference = task.taskName.match(/RFQ-\d{4}-\d{3}/)?.[0] ?? "RFQ-2025-019";
  const isTestingRfq = reference.endsWith("019");
  const rfqTitle = isTestingRfq ? "testing" : "Office supplies quotation";

  const updateStatus = (nextStatus: string) => {
    setStatus(nextStatus);
    setNotice(`RFQ ${reference} marked ${nextStatus.toLowerCase()}.`);
  };

  const reassign = () => {
    setAssignee((current) => current === "Rushi Pardeshi" ? "Aman Jain" : "Rushi Pardeshi");
    setNotice("Task reassigned.");
  };

  return (
    <section className="task-page-container">
      <header className="task-page-header">
        <button type="button" className="task-back-btn" onClick={onBack}>
          <ArrowLeft size={14} /> Back to Tasks
        </button>
        <div style={{ marginTop: 12 }}>
          <h1>REQUEST FOR QUOTATION APPROVAL FOR {reference} | {rfqTitle.toUpperCase()}</h1>
          <span className={`task-status-pill ${status === "Approved" ? "approved" : "active"}`}>{status}</span>
        </div>
      </header>

      <div className="task-card" style={{ padding: 20 }}>
        <p style={{ margin: 0, color: "var(--muted-foreground-hex, #64748b)" }}>Sample RFQ Approval for demonstration.</p>
        {notice && <p style={{ color: "var(--primary-hex, #2563eb)", marginTop: 8 }}>{notice}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="button" className="task-btn-reject" onClick={() => updateStatus("Rejected")}>Reject</button>
          <button type="button" className="task-btn-approve" onClick={() => updateStatus("Approved")}>Approve</button>
          <button type="button" className="task-btn-close" onClick={reassign}>Reassign ({assignee})</button>
        </div>
      </div>
    </section>
  );
}

function OtherApprovalTask({ task, onBack }: { task: Task; onBack: () => void }) {
  const [status, setStatus] = useState("In Review");
  const [notice, setNotice] = useState("");
  const reference = task.taskName.match(/(?:INV|PR|PO)-\d{4}-\d{3}/)?.[0] ?? "PR-2026";

  const updateStatus = (nextStatus: string) => {
    setStatus(nextStatus);
    setNotice(`${reference} marked ${nextStatus.toLowerCase()}.`);
  };

  return (
    <section className="task-page-container">
      <header className="task-page-header">
        <button type="button" className="task-back-btn" onClick={onBack}>
          <ArrowLeft size={14} /> Back to Tasks
        </button>
        <div style={{ marginTop: 12 }}>
          <h1>{task.taskName}</h1>
          <span className={`task-status-pill ${status === "Approved" ? "approved" : "active"}`}>{status}</span>
        </div>
      </header>

      <div className="task-card" style={{ padding: 20 }}>
        <p style={{ margin: 0, color: "var(--muted-foreground-hex, #64748b)" }}>{task.description || "Sample task review."}</p>
        {notice && <p style={{ color: "var(--primary-hex, #2563eb)", marginTop: 8 }}>{notice}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="button" className="task-btn-reject" onClick={() => updateStatus("Rejected")}>Reject</button>
          <button type="button" className="task-btn-approve" onClick={() => updateStatus("Approved")}>Approve</button>
        </div>
      </div>
    </section>
  );
}
