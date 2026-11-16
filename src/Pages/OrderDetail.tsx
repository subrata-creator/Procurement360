import { useEffect, useState, useCallback } from "react";
import type { FC } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpDown,
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  Clock3,
  FileText,
  Flag,
  Home,
  Info,
  Loader2,
  Mail,
  MapPin,
  Paperclip,
  Phone,
  Receipt,
  Upload,
  Users,
} from "lucide-react";

import { getOrderByRef, type OrderRecord } from "../data/OrdersData";
import { getDynamicPurchaseOrderDetails } from "../Services/PurchaseOrderService";
import { Cr49f_invoice1sService } from "../generated/services/Cr49f_invoice1sService";
import type { Cr49f_invoice1s } from "../generated/models/Cr49f_invoice1sModel";
import { cleanGuid } from "../Services/ApprovalWorkflowService";
import { UploadInvoiceModal } from "../components/UploadInvoiceModal";
import "../Styles/Styles.css";
import "../Styles/OrderSummary.css";
import "../Styles/UploadInvoiceModal.css";

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
  const [record, setRecord] = useState<OrderRecord | undefined>(() =>
    ref ? getOrderByRef(ref) : undefined
  );
  const [isLoading, setIsLoading] = useState<boolean>(!record);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoices, setInvoices] = useState<Cr49f_invoice1s[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

  const loadInvoices = useCallback(async (orderRef: string, poId?: string) => {
    setIsLoadingInvoices(true);
    try {
      const cleanPoId = poId ? cleanGuid(poId) : "";
      let dvInvoices: Cr49f_invoice1s[] = [];
      try {
        const res = await Cr49f_invoice1sService.getAll();
        if (res.success && res.data) {
          dvInvoices = res.data.filter((inv) => {
            const invPoValue = cleanGuid(inv._cr49f_associatedpo_value);
            if (cleanPoId && invPoValue === cleanPoId) return true;
            if (inv.cr49f_invoicenumber && inv.cr49f_invoicenumber.includes(orderRef)) return true;
            return false;
          });
        }
      } catch (e) {
        console.warn("Could not query Dataverse invoices:", e);
      }

      // Merge with local storage fallback
      let localInvoices: Cr49f_invoice1s[] = [];
      try {
        const storageKey = `procurement_custom_invoices_${orderRef}`;
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          localInvoices = JSON.parse(raw);
        }
      } catch {}

      // Deduplicate by invoice1id or invoicenumber
      const mergedMap = new Map<string, Cr49f_invoice1s>();
      dvInvoices.forEach((inv) => {
        const key = inv.cr49f_invoice1id || inv.cr49f_invoicenumber || "";
        if (key) mergedMap.set(key, inv);
      });
      localInvoices.forEach((inv) => {
        const key = inv.cr49f_invoice1id || inv.cr49f_invoicenumber || "";
        if (key && !mergedMap.has(key)) mergedMap.set(key, inv);
      });

      setInvoices(Array.from(mergedMap.values()));
    } catch (err) {
      console.warn("Error loading invoices:", err);
    } finally {
      setIsLoadingInvoices(false);
    }
  }, []);

  useEffect(() => {
    if (!ref) return;
    getDynamicPurchaseOrderDetails(ref)
      .then((detail) => {
        if (detail) {
          setRecord(detail);
          loadInvoices(detail.refNo, detail.dataversePoId);
        }
      })
      .catch((err) => {
        console.warn("Could not load dynamic PO detail:", err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [ref, loadInvoices]);

  useEffect(() => {
    if (record?.refNo) {
      loadInvoices(record.refNo, record.dataversePoId);
    }
  }, [record?.refNo, record?.dataversePoId, loadInvoices]);

  const handleInvoiceCreated = (newInvoice: Cr49f_invoice1s) => {
    setInvoices((prev) => [newInvoice, ...prev]);
  };

  const getPaymentStatusBadge = (status?: number, statusName?: string) => {
    if (status === 1 || statusName?.toLowerCase() === "paid") {
      return (
        <span className="order-invoice-status-badge paid">
          <CheckCircle2 size={12} /> Paid
        </span>
      );
    }
    if (status === 3 || statusName?.toLowerCase() === "partially paid") {
      return (
        <span className="order-invoice-status-badge partially-paid">
          <Clock size={12} /> Partially Paid
        </span>
      );
    }
    if (status === 4 || statusName?.toLowerCase() === "on hold") {
      return (
        <span className="order-invoice-status-badge on-hold">
          <Clock size={12} /> On Hold
        </span>
      );
    }
    return (
      <span className="order-invoice-status-badge not-paid">
        <Clock size={12} /> Not Paid
      </span>
    );
  };

  if (isLoading) {
    return (
      <main
        className="order-detail-page order-detail-notfound"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 20px",
          textAlign: "center",
        }}
      >
        <Loader2
          size={32}
          className="quotation-spin-icon"
          style={{ color: "#2563eb", marginBottom: "16px" }}
        />
        <h2>Loading Purchase Order...</h2>
        <p>Fetching purchase order and line items from Dataverse cr49f_purchaseorders...</p>
      </main>
    );
  }

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
          onClick={() => setIsInvoiceModalOpen(true)}
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

      {activeTab === "Invoices" && (
        <section className="order-detail-card order-invoices-pane">
          <div className="order-invoices-header">
            <div className="order-invoices-title-group">
              <h2 className="order-invoices-title">
                <Receipt size={16} />
                Invoices ({invoices.length})
              </h2>
              <div className="order-invoices-stat-pills">
                <span className="order-invoice-stat-pill paid">
                  {invoices.filter((i) => i.cr49f_paymentstatus === 1 || i.cr49f_paymentstatusname?.toLowerCase() === "paid").length} Paid
                </span>
                <span className="order-invoice-stat-pill not-paid">
                  {invoices.filter((i) => i.cr49f_paymentstatus === 2 || !i.cr49f_paymentstatus || i.cr49f_paymentstatusname?.toLowerCase() === "not paid").length} Not Paid
                </span>
                {invoices.some((i) => i.cr49f_paymentstatus === 3 || i.cr49f_paymentstatusname?.toLowerCase() === "partially paid") && (
                  <span className="order-invoice-stat-pill partially-paid">
                    {invoices.filter((i) => i.cr49f_paymentstatus === 3 || i.cr49f_paymentstatusname?.toLowerCase() === "partially paid").length} Partially Paid
                  </span>
                )}
                {invoices.some((i) => i.cr49f_paymentstatus === 4 || i.cr49f_paymentstatusname?.toLowerCase() === "on hold") && (
                  <span className="order-invoice-stat-pill on-hold">
                    {invoices.filter((i) => i.cr49f_paymentstatus === 4 || i.cr49f_paymentstatusname?.toLowerCase() === "on hold").length} On Hold
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              className="dashboard-create-button"
              onClick={() => setIsInvoiceModalOpen(true)}
              style={{ padding: "6px 12px", fontSize: "12.5px" }}
            >
              <span className="create-plus"><Upload size={13} /></span>
              Upload Invoice
            </button>
          </div>

          {isLoadingInvoices ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: "10px", color: "var(--muted-foreground-hex)" }}>
              <Loader2 size={20} className="quotation-spin-icon" />
              <span>Loading invoices from Dataverse cr49f_invoice1...</span>
            </div>
          ) : invoices.length === 0 ? (
            <div className="order-invoices-empty">
              <div className="order-invoices-empty-icon">
                <Receipt size={28} />
              </div>
              <h3>No Invoices Uploaded Yet</h3>
              <p>
                No billing invoices have been recorded in <code>cr49f_invoice1</code> for purchase order {record.refNo}.
                Upload the supplier's commercial invoice to track payment milestones and attachments.
              </p>
              <button
                type="button"
                className="dashboard-create-button"
                onClick={() => setIsInvoiceModalOpen(true)}
                style={{ marginTop: 6 }}
              >
                <span className="create-plus"><Upload size={13} /></span>
                Upload First Invoice
              </button>
            </div>
          ) : (
            <div className="rfq-detail-table-wrapper" style={{ border: "none", boxShadow: "none" }}>
              <table className="order-detail-table">
                <thead>
                  <tr>
                    <th>Invoice Number</th>
                    <th>Invoice Date</th>
                    <th>Due Date</th>
                    <th>Total Amount</th>
                    <th>Amount Paid</th>
                    <th>Payment Status</th>
                    <th>Attachment</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.cr49f_invoice1id || inv.cr49f_invoicenumber}>
                      <td>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 650 }}>
                          <FileText size={15} style={{ color: "var(--primary-hex, #2563eb)" }} />
                          <span>{inv.cr49f_invoicenumber || "INV-UNNAMED"}</span>
                        </div>
                      </td>
                      <td>{inv.cr49f_invoicedate ? new Date(inv.cr49f_invoicedate).toLocaleDateString() : "—"}</td>
                      <td>{inv.cr49f_duedate ? new Date(inv.cr49f_duedate).toLocaleDateString() : "—"}</td>
                      <td>
                        <strong style={{ color: "var(--foreground-hex)" }}>
                          ${(inv.cr49f_totalamount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </strong>
                      </td>
                      <td>
                        ${(inv.cr49f_amountpaid || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        {getPaymentStatusBadge(inv.cr49f_paymentstatus, inv.cr49f_paymentstatusname)}
                      </td>
                      <td>
                        {inv.cr49f_invoiceattachment ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "12px", color: "var(--primary-hex, #2563eb)" }}>
                            <Paperclip size={13} />
                            {inv.cr49f_invoiceattachment}
                          </span>
                        ) : (
                          <span style={{ color: "var(--muted-foreground-hex)", fontSize: "12px" }}>No file</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {["Shipment Details", "Associated Tasks", "Notes", "Attachments"].includes(activeTab) && (
        <section className="order-detail-card order-detail-tab-panel">
          <p className="order-detail-tab-empty">No {activeTab.toLowerCase()} linked to this purchase order yet.</p>
        </section>
      )}

      {record && (
        <UploadInvoiceModal
          isOpen={isInvoiceModalOpen}
          onClose={() => setIsInvoiceModalOpen(false)}
          order={record}
          onInvoiceCreated={handleInvoiceCreated}
        />
      )}
    </main>
  );
};

export default OrderDetail;