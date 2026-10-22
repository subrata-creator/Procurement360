import { useState } from "react";
import type { FC } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpDown,
  Banknote,
  Building2,
  Clock3,
  Flag,
  Home,
  Info,
  Mail,
  MapPin,
  Phone,
  Receipt,
  Upload,
  Users,
} from "lucide-react";

import { getOrderByRef } from "../data/OrdersData";
import "../Styles/Styles.css";
import "../Styles/OrderSummary.css";

const TABS = [
  "Summary",
  "RFQ",
  "Purchase Request",
  "Invoices",
  "Shipment Details",
  "Associated Tasks",
  "Notes",
  "Attachments",
];

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const OrderDetail: FC = () => {
  const { ref } = useParams<{ ref: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Summary");
  const [comment, setComment] = useState("");

  const record = ref ? getOrderByRef(ref) : undefined;

  if (!record) {
    return (
      <main className="order-detail-page order-detail-notfound">
        <h2>Purchase order not found</h2>
        <p>We couldn't find a purchase order matching "{ref}".</p>
        <button type="button" onClick={() => navigate("/orders")}>Back to Orders</button>
      </main>
    );
  }

  const statusSlug = record.status.toLowerCase().replace(/\s+/g, "-");

  return (
    <main className="order-detail-page">
      <header className="order-detail-header">
        <div className="order-detail-header-left">
          <button
            type="button"
            className="order-detail-back-btn"
            aria-label="Back to Orders"
            onClick={() => navigate("/orders")}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="order-detail-title-row">
              <h1>{record.refNo}</h1>
              <span className={`order-detail-status-pill ${statusSlug}`}>{record.status}</span>
            </div>
            <p className="order-detail-subtitle">
              {record.rewardedSupplier.name} · {record.pr.startsWith("PR-") ? record.pr : "No PR linked"}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="dashboard-create-button"
          // No invoicing backend wired up yet — this is a placeholder
          // affordance matching the reference UI, not a working upload.
          onClick={() => window.alert("Invoice upload isn't wired up yet — this is a placeholder action.")}
        >
          <span className="create-plus"><Upload size={14} /></span>
          Upload Invoice
        </button>
      </header>

      <nav className="order-detail-tabs" aria-label="Purchase order sections">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={tab === activeTab ? "active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === "Summary" && (
        <div className="order-detail-layout">
          <div className="order-detail-main">
            <section className="order-summary-stats">
              <div className="order-summary-stat">
                <span>Total Amount</span>
                <strong>{usdFormatter.format(record.amount)}</strong>
              </div>
              <div className="order-summary-stat">
                <span>Utilized Amount</span>
                <strong>{usdFormatter.format(record.utilizedAmount)}</strong>
              </div>
              <div className="order-summary-stat">
                <span>Remaining Amount</span>
                <strong>{usdFormatter.format(record.remainingAmount)}</strong>
              </div>
              <div className="order-summary-stat">
                <span>Start Date</span>
                <strong>{record.startDate}</strong>
              </div>
              <div className="order-summary-stat">
                <span>End Date</span>
                <strong>{record.endDate}</strong>
              </div>
              <div className="order-summary-stat order-summary-status">
                <span>Status</span>
                <strong><span className={`order-detail-status-pill ${statusSlug}`}>{record.status}</span></strong>
              </div>
            </section>

            <section className="order-detail-card">
              <h2><Users size={16} /> Rewarded Supplier</h2>
              <div className="order-supplier-grid">
                <div>
                  <span className="order-field-icon"><Building2 size={14} /></span>
                  <div>
                    <small>Supplier</small>
                    <strong>{record.rewardedSupplier.name}</strong>
                  </div>
                </div>
                <div>
                  <span className="order-field-icon"><Mail size={14} /></span>
                  <div>
                    <small>Email</small>
                    <strong>{record.rewardedSupplier.email}</strong>
                  </div>
                </div>
                <div>
                  <span className="order-field-icon"><Phone size={14} /></span>
                  <div>
                    <small>Phone Number</small>
                    <strong>{record.rewardedSupplier.phone}</strong>
                  </div>
                </div>
                <div>
                  <span className="order-field-icon"><Home size={14} /></span>
                  <div>
                    <small>Address</small>
                    <strong>{record.rewardedSupplier.address}</strong>
                  </div>
                </div>
                <div>
                  <span className="order-field-icon"><Receipt size={14} /></span>
                  <div>
                    <small>Ranking</small>
                    <strong>{record.rewardedSupplier.ranking}</strong>
                  </div>
                </div>
                <div>
                  <span className="order-field-icon"><Flag size={14} /></span>
                  <div>
                    <small>Active</small>
                    <strong>{record.rewardedSupplier.active ? "Yes" : "No"}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="order-detail-card">
              <h2><Receipt size={16} /> Order Line Items</h2>
              <div className="order-detail-table-wrap">
                <table className="order-detail-table">
                  <thead>
                    <tr>
                      <th>Item Code <ArrowUpDown size={11} /></th>
                      <th>Item Name <ArrowUpDown size={11} /></th>
                      <th>Quantity <ArrowUpDown size={11} /></th>
                      <th>Unit Price <ArrowUpDown size={11} /></th>
                      <th>VAT % <ArrowUpDown size={11} /></th>
                      <th>Amount <ArrowUpDown size={11} /></th>
                      <th>Delivery Address <ArrowUpDown size={11} /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.lineItems.map((item) => (
                      <tr key={item.id}>
                        <td>{item.itemCode}</td>
                        <td>{item.itemName}</td>
                        <td>{item.quantity}</td>
                        <td>{usdFormatter.format(item.unitPrice)}</td>
                        <td>{item.vatPercent.toFixed(2)}%</td>
                        <td>{usdFormatter.format(item.amount)}</td>
                        <td className="order-delivery-cell"><MapPin size={13} />{item.deliveryAddress}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="order-detail-card">
              <h2><Banknote size={16} /> Payment Terms</h2>
              <div className="order-detail-table-wrap">
                <table className="order-detail-table">
                  <thead>
                    <tr>
                      <th>Term Name <ArrowUpDown size={11} /></th>
                      <th>Description <ArrowUpDown size={11} /></th>
                      <th>Percentage (%) <ArrowUpDown size={11} /></th>
                      <th>Amount <ArrowUpDown size={11} /></th>
                      <th aria-label="Info"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.paymentTerms.map((term) => (
                      <tr key={term.termName}>
                        <td>{term.termName}</td>
                        <td>{term.description || "—"}</td>
                        <td>{term.percent.toFixed(2)}%</td>
                        <td>{usdFormatter.format(term.amount)}</td>
                        <td><Info size={14} className="order-info-icon" aria-hidden="true" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="order-detail-card">
              <h2>Associated Budget Codes</h2>
              <div className="order-detail-table-wrap">
                <table className="order-detail-table">
                  <thead>
                    <tr>
                      <th>Budget Code Abbreviation <ArrowUpDown size={11} /></th>
                      <th>Budget Code <ArrowUpDown size={11} /></th>
                      <th>Department <ArrowUpDown size={11} /></th>
                      <th>Percentage (%) <ArrowUpDown size={11} /></th>
                      <th>Amount <ArrowUpDown size={11} /></th>
                      <th aria-label="Info"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.budgetCodes.map((code) => (
                      <tr key={code.code}>
                        <td className="order-link-text">{code.abbreviation}</td>
                        <td>{code.code}</td>
                        <td className="order-link-text">{code.department}</td>
                        <td>{code.percent.toFixed(2)}%</td>
                        <td>{usdFormatter.format(code.amount)}</td>
                        <td><Info size={14} className="order-info-icon" aria-hidden="true" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="order-detail-card">
              <h2>Approvers Comments</h2>
              {/* Not wired to a backend — typing here is local to this
                  session only and isn't submitted or persisted anywhere. */}
              <textarea
                className="order-comments-box"
                placeholder="Add a comment..."
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={3}
              />
            </section>
          </div>

          <aside className="order-approval-sidebar">
            <h2><Clock3 size={16} /> Approval History</h2>
            <ol className="order-approval-rail">
              {record.approvalSteps.map((step) => (
                <li key={step.id} className={step.status}>
                  <span className="order-approval-dot" aria-hidden="true" />
                  <div>
                    <strong>{step.label}</strong>
                    <p>
                      <span className="order-link-text">{step.actor}</span>: {step.role}
                      <br />
                      {step.department}
                      {step.timestamp && <><br />{step.timestamp}</>}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}

      {activeTab === "RFQ" && (
        <section className="order-detail-card order-detail-tab-panel">
          {record.rfq.startsWith("RFQ-") ? (
            <p>
              Linked to <button type="button" className="order-link-text order-link-btn" onClick={() => navigate(`/rfqs/${record.rfq}`)}>{record.rfq}</button>.
            </p>
          ) : (
            <p className="order-detail-tab-empty">No RFQ linked to this purchase order.</p>
          )}
        </section>
      )}

      {activeTab === "Purchase Request" && (
        <section className="order-detail-card order-detail-tab-panel">
          {record.pr.startsWith("PR-") ? (
            <p>
              Linked to <button type="button" className="order-link-text order-link-btn" onClick={() => navigate(`/purchase-requests/${record.pr}`)}>{record.pr}</button>.
            </p>
          ) : (
            <p className="order-detail-tab-empty">No Purchase Request linked to this purchase order.</p>
          )}
        </section>
      )}

      {["Invoices", "Shipment Details", "Associated Tasks", "Notes", "Attachments"].includes(activeTab) && (
        <section className="order-detail-card order-detail-tab-panel">
          <p className="order-detail-tab-empty">No {activeTab.toLowerCase()} linked to this purchase order yet.</p>
        </section>
      )}
    </main>
  );
};

export default OrderDetail;