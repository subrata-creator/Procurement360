import { useState } from "react";

import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronUp,
  ClipboardList,
  Clock,
  Coins,
  Download,
  FileText,
  Flag,
  Hash,
  MoreHorizontal,
  PackageCheck,
  ShieldCheck,
  Tag,
  User,
} from "lucide-react";

import { useNavigate, useParams } from "react-router-dom";

import {
  buildApprovalSteps,
  buildDefaultLineItems,
  buildMilestoneSubTasks,
  getInitials,
  getPurchaseRequestByRef,
  type ApprovalStep,
} from "./Purchaserequestsdata";

import "../Styles/PRSummary.css";

const TABS = ["Summary", "RFQs", "Orders", "Associated Tasks", "Notes", "Attachments"];

function statusPillClass(status: string) {
  if (status === "Approved") return "approved";
  if (status === "Rejected") return "rejected";
  return "review";
}

function subtaskStatusClass(status: string) {
  if (status === "Completed") return "completed";
  if (status === "In Progress") return "in-progress";
  return "pending";
}

function stepCircleClass(status: string) {
  if (status === "Completed") return "completed";
  if (status === "Current") return "current";
  if (status === "Rejected") return "rejected";
  return "";
}

function milestoneIconClass(status: string) {
  if (status === "Completed") return "green";
  if (status === "Current") return "current";
  if (status === "Rejected") return "rejected";
  return "pending";
}

export default function PurchaseRequestDetail() {
  const { ref } = useParams<{ ref: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("Summary");
  const [subTasksOpen, setSubTasksOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<ApprovalStep | null>(null);

  const record = ref ? getPurchaseRequestByRef(ref) : undefined;

  if (!record) {
    return (
      <div className="pr-detail-page">
        <div className="pr-detail-notfound">
          <p>Purchase Request not found.</p>
          <button type="button" onClick={() => navigate("/purchase-requests")}>Back to Purchase Requests</button>
        </div>
      </div>
    );
  }

  const approvalSteps = buildApprovalSteps(record);
  const creationStep = approvalSteps.find((step) => /^PR creation/i.test(step.title));
  const approvalHistory = approvalSteps.filter((step) =>
    (step.status === "Completed" || step.status === "Rejected") &&
    /(approval|rejected)/i.test(step.title)
  );
  const historyEvents = [
    ...(creationStep ? [creationStep] : []),
    ...approvalHistory.filter((step) => step.step !== creationStep?.step),
  ];
  const subTasks = selectedMilestone ? buildMilestoneSubTasks(record, selectedMilestone) : [];
  const lineItems = buildDefaultLineItems(record);

  const subTasksCompleted = subTasks.length > 0 && subTasks.every((task) => task.status === "Completed");

  const toggleMilestone = (step: ApprovalStep) => {
    if (subTasksOpen && selectedMilestone?.step === step.step) {
      setSubTasksOpen(false);
      setSelectedMilestone(null);
      return;
    }

    setSelectedMilestone(step);
    setSubTasksOpen(true);
  };

  return (
    <div className="pr-detail-page">
      <div className="pr-detail-heading">
        <div className="pr-detail-heading-left">
          <button type="button" className="pr-detail-back" onClick={() => navigate(-1)}>
            <ArrowLeft size={12} />
          </button>

          <div>
            <div className="pr-detail-title-row">
              <h1>{record.ref}</h1>
              <span className={`pr-detail-status-pill ${statusPillClass(record.status)}`}>{record.status}</span>
            </div>
            <p className="pr-detail-subtitle">{record.title}</p>
          </div>
        </div>

        <div className="pr-detail-actions">
          
          <button type="button" className="pr-detail-primary-btn">
            <FileText size={11} />
            Initiate RFQ
          </button>
        </div>
      </div>

      <section className="pr-detail-card pr-journey-card">
        <div className="pr-detail-card-header">
          <div className="pr-detail-card-header-left">
            <div className="pr-detail-card-icon">
              <Clock size={12} />
            </div>
            <div className="pr-detail-card-title">
              <h2>PR Journey</h2>
              <p>Track progress from PR creation through closure</p>
            </div>
          </div>
        </div>

        <div className="approval-timeline">
          {approvalSteps.map((step) => (
            <button
              className={`approval-step ${selectedMilestone?.step === step.step ? "selected" : ""}`}
              key={step.step}
              type="button"
              aria-label={`${step.title}, ${step.status}. View milestone tasks`}
              aria-pressed={selectedMilestone?.step === step.step}
              aria-expanded={subTasksOpen && selectedMilestone?.step === step.step}
              onClick={() => toggleMilestone(step)}
            >
              <div className={`approval-step-line ${step.status === "Completed" ? "done" : ""}`} />
              <div className={`approval-step-circle ${stepCircleClass(step.status)}`}>{step.step}</div>

              <div className="approval-step-label">
                <strong>{step.title}</strong>
                <span className={`approval-step-status ${step.status.toLowerCase().replace(" ", "-")}`}>
                  {step.status === "Skipped" ? "Not Applicable" : step.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {selectedMilestone && (
        <>
          <section className="pr-detail-card">
            <div className="pr-detail-card-header">
              <div className="pr-detail-card-header-left">
                <div className={`pr-detail-card-icon ${milestoneIconClass(selectedMilestone.status)}`}>
                  <ShieldCheck size={12} />
                </div>
                <div className="pr-detail-card-title">
                  <h2>{selectedMilestone.title} - Sub Tasks</h2>
                  <p>{selectedMilestone.date ? `Milestone activity on ${selectedMilestone.date}` : `Milestone status: ${selectedMilestone.status}`}{selectedMilestone.by ? ` · ${selectedMilestone.by}` : ""}</p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                {subTasksCompleted && (
                  <span className="pr-detail-status-tag">
                    <ShieldCheck size={9} />
                    Completed
                  </span>
                )}

                <button
                  type="button"
                  className="pr-detail-collapse-btn"
                  onClick={() => setSubTasksOpen((open) => !open)}
                  style={{ transform: subTasksOpen ? "rotate(0deg)" : "rotate(180deg)" }}
                >
                  <ChevronUp size={12} />
                </button>
              </div>
            </div>

            {subTasksOpen && (
              <div className="pr-detail-table-wrapper">
                <table className="pr-detail-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Task</th>
                      <th>Status</th>
                      <th>Assigned To</th>
                      <th>Remarks</th>
                      <th>Completed On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subTasks.map((task, index) => (
                      <tr key={task.id}>
                        <td>{index + 1}</td>
                        <td>{task.task}</td>
                        <td>
                          <span className={`subtask-status ${subtaskStatusClass(task.status)}`}>{task.status}</span>
                        </td>
                        <td>
                          <div className="pr-detail-table-avatar">
                            <span>{getInitials(task.assignedTo)}</span>
                            {task.assignedTo}
                          </div>
                        </td>
                        <td>{task.remarks}</td>
                        <td>{task.completedOn || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <section className="pr-detail-card">
        <div className="pr-detail-tabs">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? "active" : ""}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab !== "Summary" && (
          <div className="pr-detail-tab-empty">No {activeTab.toLowerCase()} linked to this purchase request yet.</div>
        )}

        {activeTab === "Summary" && (
          <>
            <div className="pr-summary-layout">
              <div className="pr-summary-main-column">
            <div className="pr-summary-top">
              <div className="pr-summary-title">
                <ClipboardList size={13} />
                Purchase Request Details
              </div>

              <div className="pr-summary-badges">
                <div className="pr-summary-badge amount">
                  <span>Total Amount</span>
                  <strong>{record.totalAmount || "USD -"}</strong>
                </div>

                <div className="pr-summary-badge status">
                  <span>Status</span>
                  <strong>
                    <ShieldCheck size={10} />
                    {record.status}
                  </strong>
                </div>
              </div>
            </div>

            <div className="pr-detail-grid">
              <div className="pr-detail-field">
                <div className="pr-detail-field-icon"><FileText size={11} /></div>
                <div>
                  <span>PR Number</span>
                  <strong>{record.ref}</strong>
                </div>
              </div>

              <div className="pr-detail-field">
                <div className="pr-detail-field-icon"><User size={11} /></div>
                <div>
                  <span>Requester</span>
                  <strong>{record.requester || record.createdBy}</strong>
                </div>
              </div>

              <div className="pr-detail-field">
                <div className="pr-detail-field-icon"><Tag size={11} /></div>
                <div>
                  <span>Title</span>
                  <strong>{record.title}</strong>
                </div>
              </div>

              <div className="pr-detail-field">
                <div className="pr-detail-field-icon"><Building2 size={11} /></div>
                <div>
                  <span>Department</span>
                  <strong>{record.department || "—"}</strong>
                </div>
              </div>

              <div className="pr-detail-field">
                <div className="pr-detail-field-icon"><CalendarDays size={11} /></div>
                <div>
                  <span>Request Date</span>
                  <strong>{record.date}</strong>
                </div>
              </div>

              <div className="pr-detail-field">
                <div className="pr-detail-field-icon"><CalendarDays size={11} /></div>
                <div>
                  <span>Required Date</span>
                  <strong>{record.requiredDate || "—"}</strong>
                </div>
              </div>

              <div className="pr-detail-field">
                <div className="pr-detail-field-icon"><PackageCheck size={11} /></div>
                <div>
                  <span>Category</span>
                  <strong>{record.category || "—"}</strong>
                </div>
              </div>

              <div className="pr-detail-field">
                <div className="pr-detail-field-icon"><Flag size={11} /></div>
                <div>
                  <span>Priority</span>
                  <strong>{record.priority || "—"}</strong>
                </div>
              </div>

              <div className="pr-detail-field">
                <div className="pr-detail-field-icon"><Hash size={11} /></div>
                <div>
                  <span>Cost Center</span>
                  <strong>{record.costCenter || "—"}</strong>
                </div>
              </div>

              <div className="pr-detail-field">
                <div className="pr-detail-field-icon"><ClipboardList size={11} /></div>
                <div>
                  <span>Associated RFQ</span>
                  <strong>{record.rfq}</strong>
                </div>
              </div>

              <div className="pr-detail-field">
                <div className="pr-detail-field-icon"><FileText size={11} /></div>
                <div>
                  <span>Associated PO</span>
                  <strong>{record.po}</strong>
                </div>
              </div>
            </div>

            <div className="pr-detail-justification">
              <span>Business Justification</span>
              <p>{record.justification || "No business justification provided."}</p>
              <small>Delivery location: {record.deliveryAddress || "—"}</small>
            </div>

            <div className="pr-detail-lineitems-heading">
              <Coins size={11} />
              Purchase Request Line Items ({lineItems.length})
            </div>

            <div className="pr-detail-table-wrapper">
              <table className="pr-detail-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item Code</th>
                    <th>Item Name</th>
                    <th>Quantity</th>
                    <th>Previous Contract</th>
                    <th>Unit Price</th>
                    <th>Total Amount</th>
                    <th>Delivery Date</th>
                    <th>Delivery Address</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td>{item.itemCode}</td>
                      <td>{item.itemName}</td>
                      <td>{item.quantity}</td>
                      <td>{item.previousContract}</td>
                      <td>{item.unitPrice}</td>
                      <td>{item.totalAmount}</td>
                      <td>{item.deliveryDate}</td>
                      <td>{item.deliveryAddress}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              </div>

              <aside className="pr-summary-approval-card">
                <div className="pr-summary-approval-heading">
                  <Clock size={17} />
                  <h2>Approval History</h2>
                </div>
                <div className="pr-summary-approval-list">
                  {historyEvents.length > 0 ? historyEvents.map((step, index) => {
                    const [actor, role] = (step.by ?? "").split("|").map((part) => part.trim());
                    return (
                    <button
                      type="button"
                      className={`pr-summary-approval-step ${step.status.toLowerCase()} ${selectedMilestone?.step === step.step ? "selected" : ""}`}
                      key={step.step}
                      aria-label={`${step.title}, ${step.status}. View milestone tasks`}
                      aria-expanded={subTasksOpen && selectedMilestone?.step === step.step}
                      onClick={() => toggleMilestone(step)}
                    >
                      <span className="pr-summary-approval-rail">
                        <span className="pr-summary-approval-node">{step.status === "Completed" ? "✓" : index + 1}</span>
                      </span>
                      <span className="pr-summary-approval-copy">
                        <strong>{step.title}</strong>
                        {actor && <span><b>{actor}</b>{role && <>: <em>{role}</em></>}</span>}
                        {step.department && <span>{step.department}</span>}
                        {step.date && <small>{step.date}</small>}
                      </span>
                    </button>
                    );
                  }) : <p className="pr-summary-approval-empty">No approval actions recorded yet.</p>}
                </div>
              </aside>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
