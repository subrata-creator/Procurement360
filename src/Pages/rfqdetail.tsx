import { useState } from "react";

import {
  Building2,
  CalendarDays,
  CircleCheck,
  ClipboardList,
  Clock,
  Coins,
  FileText,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Trophy,
  ArrowLeft,
  Percent,
} from "lucide-react";

import { useNavigate, useParams } from "react-router-dom";

import {
  buildRfqApprovalSteps,
  getInitials,
  getRfqByRef,
  totalBudgetFor,
  type RfqApprovalStep,
} from "../data/RFQdata";

import "../Styles/RFQSummary.css";

const TABS = [
  "Summary",
  "Purchase Request",
  "Orders",
  "Invoices",
  "Supplier Responses",
  "Supplier Clarifications",
  "Reward History",
  "Associated Tasks",
  "Notes",
  "Attachments",
];

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

function statusPillClass(status: string) {
  return status === "Rewarded" ? "rewarded" : "approved";
}

function approvalStepClass(status: RfqApprovalStep["status"]) {
  if (status === "Completed") return "completed";
  if (status === "Current") return "current";
  if (status === "Rejected") return "rejected";
  return "pending";
}

export default function RfqDetail() {
  const { ref } = useParams<{ ref: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Summary");

  const record = ref ? getRfqByRef(ref) : undefined;

  if (!record) {
    return (
      <div className="rfq-detail-page">
        <div className="rfq-detail-notfound">
          <p>RFQ not found.</p>
          <button type="button" onClick={() => navigate("/rfqs")}>Back to RFQs</button>
        </div>
      </div>
    );
  }

  const approvalSteps = buildRfqApprovalSteps(record);
  const totalBudget = totalBudgetFor(record);
  const isLinkedToPr = record.pr.startsWith("PR-");

  const aiSummary = [
    `This RFQ (${record.title}) invited ${record.responsesInvited} supplier${record.responsesInvited === 1 ? "" : "s"} and has received ${record.responsesReceived} response${record.responsesReceived === 1 ? "" : "s"} so far.`,
    record.status === "Rewarded"
      ? `It has been awarded to ${record.supplier !== "N/A" ? record.supplier : "the selected supplier"} on ${record.rewardDate}, with a total quotation value of ${usdFormatter.format(totalBudget)}.`
      : `It is currently awaiting evaluation — responses are due by ${record.responseDueDate}, with a running quotation value of ${usdFormatter.format(totalBudget)}.`,
    isLinkedToPr ? `Linked to purchase request ${record.pr}.` : "No purchase request is linked to this RFQ yet.",
  ].join(" ");

  return (
    <div className="rfq-detail-page">
      <div className="rfq-detail-heading">
        <div className="rfq-detail-heading-left">
          <button type="button" className="rfq-detail-back" onClick={() => navigate(-1)}>
            <ArrowLeft size={12} />
          </button>
          <div>
            <div className="rfq-detail-title-row">
              <h1>{record.refNo}</h1>
              <span className={`rfq-detail-status-pill ${statusPillClass(record.status)}`}>{record.status}</span>
            </div>
            <p className="rfq-detail-subtitle">{record.title}</p>
          </div>
        </div>

        <div className="rfq-detail-actions">
          <button type="button" className="rfq-detail-primary-btn">
            <FileText size={11} />
            Create Purchase Order
          </button>
        </div>
      </div>

      <section className="rfq-detail-card rfq-journey-card">
        <div className="rfq-detail-card-header">
          <div className="rfq-detail-card-header-left">
            <div className="rfq-detail-card-icon">
              <Clock size={12} />
            </div>
            <div className="rfq-detail-card-title">
              <h2>RFQ Journey</h2>
              <p>Track progress from RFQ creation through reward</p>
            </div>
          </div>
        </div>

        <div className="rfq-approval-timeline">
          {approvalSteps.map((step, index) => (
            <div className="rfq-approval-step" key={step.step}>
              <div className={`rfq-approval-step-line ${step.status === "Completed" ? "done" : ""}`} />
              <div className={`rfq-approval-step-circle ${approvalStepClass(step.status)}`}>
                {step.status === "Completed" ? <CircleCheck size={14} /> : index + 1}
              </div>
              <div className="rfq-approval-step-label">
                <strong>{step.title}</strong>
                <span className={`rfq-approval-step-status ${approvalStepClass(step.status)}`}>
                  {step.status === "Current" ? "In Progress" : step.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rfq-detail-card">
        <div className="rfq-detail-tabs">
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

        {activeTab === "Summary" && (
          <>
            <section className="rfq-summary-kpis" aria-label="RFQ summary metrics">
              <article className="rfq-summary-kpi amount">
                <span className="rfq-summary-kpi-icon"><Coins size={15} /></span>
                <span className="rfq-summary-kpi-copy"><small>Total Budget</small><strong>{usdFormatter.format(totalBudget)}</strong></span>
              </article>
              <article className={`rfq-summary-kpi ${statusPillClass(record.status)}`}>
                <span className="rfq-summary-kpi-icon"><ShieldCheck size={15} /></span>
                <span className="rfq-summary-kpi-copy"><small>Current Status</small><strong>{record.status}</strong></span>
              </article>
              <article className="rfq-summary-kpi responses">
                <span className="rfq-summary-kpi-icon"><Percent size={15} /></span>
                <span className="rfq-summary-kpi-copy"><small>Responses</small><strong>{record.responsesReceived} of {record.responsesInvited}</strong></span>
              </article>
              <article className="rfq-summary-kpi due-date">
                <span className="rfq-summary-kpi-icon"><CalendarDays size={15} /></span>
                <span className="rfq-summary-kpi-copy"><small>Response Due</small><strong>{record.responseDueDate}</strong></span>
              </article>
            </section>

            <div className="rfq-summary-layout">
              <div className="rfq-summary-main-column">
                <section className="rfq-ai-summary" aria-labelledby="rfq-ai-summary-title">
                  <div className="rfq-ai-summary-heading">
                    <span><Sparkles size={14} /></span>
                    <h2 id="rfq-ai-summary-title">AI Summary</h2>
                    <small>Record-backed</small>
                  </div>
                  <p>{aiSummary}</p>
                  <span className="rfq-ai-summary-note">Generated from the fields and supplier responses recorded on this RFQ.</span>
                </section>

                <div className="rfq-summary-top">
                  <div className="rfq-summary-title">
                    <ClipboardList size={13} />
                    RFQ Details
                  </div>
                </div>

                <div className="rfq-detail-grid">
                  <div className="rfq-detail-field">
                    <div className="rfq-detail-field-icon"><CalendarDays size={11} /></div>
                    <div><span>Start Date</span><strong>{record.startDate}</strong></div>
                  </div>
                  <div className="rfq-detail-field">
                    <div className="rfq-detail-field-icon"><CalendarDays size={11} /></div>
                    <div><span>Clarification Date</span><strong>{record.clarificationDate}</strong></div>
                  </div>
                  <div className="rfq-detail-field">
                    <div className="rfq-detail-field-icon"><CalendarDays size={11} /></div>
                    <div><span>Response Due Date</span><strong>{record.responseDueDate}</strong></div>
                  </div>
                  <div className="rfq-detail-field">
                    <div className="rfq-detail-field-icon"><CalendarDays size={11} /></div>
                    <div><span>Reward Date</span><strong>{record.rewardDate}</strong></div>
                  </div>
                  <div className="rfq-detail-field">
                    <div className="rfq-detail-field-icon"><ClipboardList size={11} /></div>
                    <div><span>Responses Received</span><strong>{record.responsesReceived}/{record.responsesInvited}</strong></div>
                  </div>
                  <div className="rfq-detail-field">
                    <div className="rfq-detail-field-icon"><FileText size={11} /></div>
                    <div><span>Associated PR</span><strong>{isLinkedToPr ? record.pr : "Not linked"}</strong></div>
                  </div>
                </div>

                <div className="rfq-detail-lineitems-heading">
                  <Building2 size={11} />
                  Invited Suppliers ({record.invitedSuppliers.length})
                </div>

                <div className="rfq-detail-table-wrapper">
                  <table className="rfq-detail-table">
                    <thead>
                      <tr>
                        <th>Supplier Details</th>
                        <th>Contact Information</th>
                        <th>Address</th>
                        <th>Ranking</th>
                        <th>Rewarded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {record.invitedSuppliers.map((supplier) => (
                        <tr key={supplier.id}>
                          <td>
                            <div className="rfq-detail-table-avatar">
                              <span>{getInitials(supplier.name)}</span>
                              {supplier.name}
                              {supplier.verified && <ShieldCheck size={12} className="rfq-supplier-verified" />}
                            </div>
                          </td>
                          <td>
                            <div className="rfq-supplier-contact">
                              <span><Mail size={11} />{supplier.email}</span>
                              <span><Phone size={11} />{supplier.phone}</span>
                            </div>
                          </td>
                          <td>
                            <div className="rfq-supplier-address"><MapPin size={11} />{supplier.address}</div>
                          </td>
                          <td>
                            <span className="rfq-supplier-rank"><Trophy size={13} />{supplier.ranking}</span>
                          </td>
                          <td>
                            <span className={`rfq-supplier-rewarded-pill ${supplier.rewarded ? "rewarded" : ""}`}>
                              {supplier.rewarded ? "Rewarded" : "Not Rewarded"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rfq-detail-lineitems-heading">
                  <Coins size={11} />
                  Quotation Line Items ({record.lineItems.length})
                </div>

                <div className="rfq-detail-table-wrapper">
                  <table className="rfq-detail-table">
                    <thead>
                      <tr>
                        <th>Item Code</th>
                        <th>Item Name</th>
                        <th>Quantity</th>
                        <th>Unit Price</th>
                        <th>Total Amount</th>
                        <th>Delivery Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {record.lineItems.map((item) => (
                        <tr key={item.id}>
                          <td>{item.itemCode}</td>
                          <td>{item.itemName}</td>
                          <td>{item.quantity}</td>
                          <td>{usdFormatter.format(item.unitPrice)}</td>
                          <td>{usdFormatter.format(item.totalAmount)}</td>
                          <td>{item.deliveryAddress}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <aside className="rfq-summary-approval-card">
                <div className="rfq-summary-approval-heading">
                  <Clock size={17} />
                  <h2>Approval History</h2>
                </div>
                <div className="rfq-summary-approval-list">
                  {approvalSteps
                    .filter((step) => step.status === "Completed" || step.status === "Current" || step.status === "Rejected")
                    .map((step, index) => {
                      const [actor, role] = (step.by ?? "").split("|").map((part) => part.trim());
                      return (
                        <div className={`rfq-summary-approval-step ${approvalStepClass(step.status)}`} key={step.step}>
                          <span className="rfq-summary-approval-rail">
                            <span className="rfq-summary-approval-node">{step.status === "Completed" ? "✓" : index + 1}</span>
                          </span>
                          <span className="rfq-summary-approval-copy">
                            <strong>{step.title}</strong>
                            <span className={`rfq-summary-approval-badge ${approvalStepClass(step.status)}`}>
                              {step.status === "Current" ? "In progress" : step.status}
                            </span>
                            {actor && <span><b>{actor}</b>{role && <>: <em>{role}</em></>}</span>}
                            {step.department && <span>{step.department}</span>}
                            {step.date && <small>{step.date}</small>}
                          </span>
                        </div>
                      );
                    })}
                  {approvalSteps.every((step) => step.status === "Pending") && (
                    <p className="rfq-summary-approval-empty">No approval actions recorded yet.</p>
                  )}
                </div>
              </aside>
            </div>
          </>
        )}

        {activeTab === "Purchase Request" && (
          isLinkedToPr ? (
            <div className="rfq-detail-tab-empty">
              Associated purchase request: <button type="button" className="rfq-inline-link" onClick={() => navigate(`/purchase-requests/${record.pr}`)}>{record.pr}</button>
            </div>
          ) : (
            <div className="rfq-detail-tab-empty">No purchase request linked to this RFQ.</div>
          )
        )}

        {["Orders", "Invoices", "Supplier Responses", "Supplier Clarifications", "Reward History", "Associated Tasks", "Notes", "Attachments"].includes(activeTab) && (
          <div className="rfq-detail-tab-empty">No {activeTab.toLowerCase()} linked to this RFQ yet.</div>
        )}
      </section>
    </div>
  );
}