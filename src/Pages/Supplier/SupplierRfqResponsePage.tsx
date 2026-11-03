import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Lock,
  Mail,
  Package,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
} from "lucide-react";

import {
  getSupplierRfqDetails,
  saveSupplierResponseDraft,
  submitSupplierResponse,
  type FullSupplierResponse,
  type SupplierResponseLineItem,
} from "../../Services/RfqSupplierResponseService";
import { Cr49f_suppliersService } from "../../generated/services/Cr49f_suppliersService";
import type { Cr49f_requestforqoutations } from "../../generated/models/Cr49f_requestforqoutationsModel";
import type { Cr49f_suppliers } from "../../generated/models/Cr49f_suppliersModel";

import "../../Styles/SupplierPortal.css";

interface SupplierRfqResponsePageProps {
  userEmail?: string;
  userName?: string;
}

export const SupplierRfqResponsePage: React.FC<SupplierRfqResponsePageProps> = ({
  userEmail,
  userName,
}) => {
  const { id: rfqId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [rfq, setRfq] = useState<Cr49f_requestforqoutations | null>(null);
  const [response, setResponse] = useState<FullSupplierResponse | null>(null);
  const [lines, setLines] = useState<SupplierResponseLineItem[]>([]);

  // Commercial terms
  const [deliveryDate, setDeliveryDate] = useState<string>("");
  const [paymentTerms, setPaymentTerms] = useState<string>("Net 30");
  const [warranty, setWarranty] = useState<string>("1 Year Standard Warranty");

  const [activeSupplier, setActiveSupplier] = useState<Cr49f_suppliers | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingDraft, setSavingDraft] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState<boolean>(false);

  // 1. Resolve Supplier Identity
  useEffect(() => {
    let isMounted = true;
    const resolveSup = async () => {
      try {
        const suppRes = await Cr49f_suppliersService.getAll();
        const allSupp = suppRes.success && suppRes.data ? suppRes.data : [];

        if (isMounted) {
          const matched = allSupp.find(
            (s) =>
              (userEmail && s.cr49f_email?.toLowerCase() === userEmail.toLowerCase()) ||
              (userName && s.cr49f_contactperson?.toLowerCase() === userName.toLowerCase()) ||
              (userName && s.cr49f_name?.toLowerCase() === userName.toLowerCase())
          );

          const savedSupId = localStorage.getItem("procurement360_active_supplier_id");
          const preferred =
            (savedSupId && allSupp.find((s) => s.cr49f_supplierid === savedSupId || s.cr49f_supplierid1 === savedSupId)) ||
            matched ||
            allSupp[0] ||
            null;

          setActiveSupplier(preferred);
        }
      } catch (err) {
        console.warn("Failed to load suppliers:", err);
      }
    };

    void resolveSup();
    return () => {
      isMounted = false;
    };
  }, [userEmail, userName]);

  // 2. Load RFQ & response details
  const loadData = async () => {
    if (!rfqId || !activeSupplier) return;
    try {
      setLoading(true);
      setError(null);
      setAccessDenied(false);

      const supId = activeSupplier.cr49f_supplierid1 || activeSupplier.cr49f_supplierid;
      const res = await getSupplierRfqDetails(rfqId, supId, activeSupplier.cr49f_email);

      setRfq(res.rfq);
      setResponse(res.response);
      setLines(res.response.lines);

      if (res.response.deliveryDate) setDeliveryDate(res.response.deliveryDate);
      if (res.response.paymentTerms) setPaymentTerms(res.response.paymentTerms);
      if (res.response.warranty) setWarranty(res.response.warranty);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load RFQ.";
      if (msg.includes("Access Denied") || msg.includes("not authorized")) {
        setAccessDenied(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [rfqId, activeSupplier]);

  const isSubmitted = response?.status === "Submitted";

  // Handle line item field edits
  const handleLineChange = (
    index: number,
    field: keyof SupplierResponseLineItem,
    value: string | number
  ) => {
    if (isSubmitted) return;

    setLines((prev) => {
      const updated = [...prev];
      const target = { ...updated[index] };

      if (field === "unitPrice" || field === "offeredQuantity" || field === "discount" || field === "tax") {
        const numVal = Math.max(0, Number(value) || 0);
        target[field] = numVal;
        const discount = target.discount || 0;
        const tax = target.tax || 0;
        const base = target.unitPrice * target.offeredQuantity;
        target.totalPrice = base * (1 - discount / 100) * (1 + tax / 100);
      } else {
        (target as Record<string, unknown>)[field] = value;
      }

      updated[index] = target;
      return updated;
    });
  };

  // Computed total
  const calculatedTotal = useMemo(() => {
    return lines.reduce((sum, line) => sum + (line.totalPrice || 0), 0);
  }, [lines]);

  // Save as Draft action
  const handleSaveDraft = async () => {
    if (!response || isSubmitted) return;
    try {
      setSavingDraft(true);
      setError(null);
      setSuccessMsg(null);

      const formattedLines = lines.map((l) => ({
        id: l.id,
        unitPrice: l.unitPrice,
        offeredQuantity: l.offeredQuantity,
        discount: l.discount,
        tax: l.tax,
        leadTime: l.leadTime,
        comments: l.comments,
      }));

      await saveSupplierResponseDraft(response.responseId, formattedLines, {
        deliveryDate,
        paymentTerms,
        warranty,
      });

      setSuccessMsg("Quotation draft saved successfully. You can continue editing anytime.");
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save draft.");
    } finally {
      setSavingDraft(false);
    }
  };

  // Submit Response action
  const handleSubmitResponse = async () => {
    if (!response || isSubmitted) return;
    try {
      setSubmitting(true);
      setError(null);
      setSuccessMsg(null);

      // Validation check
      const missingPrice = lines.some((l) => !l.unitPrice || l.unitPrice <= 0);
      if (missingPrice) {
        throw new Error("Please specify a valid quoted unit price (> 0) for all RFQ line items before submitting.");
      }

      const formattedLines = lines.map((l) => ({
        id: l.id,
        unitPrice: l.unitPrice,
        offeredQuantity: l.offeredQuantity,
        discount: l.discount,
        tax: l.tax,
        leadTime: l.leadTime,
        comments: l.comments,
      }));

      await submitSupplierResponse(response.responseId, formattedLines, {
        deliveryDate,
        paymentTerms,
        warranty,
      });

      setSuccessMsg("Quotation submitted successfully! The procurement team has been notified.");
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit quotation.");
    } finally {
      setSubmitting(false);
    }
  };

  // Access Denied Screen (Strict Dataverse Authorization)
  if (accessDenied) {
    return (
      <div className="supplier-portal-container">
        <div className="supplier-denied-box">
          <div className="supplier-denied-icon">
            <ShieldAlert size={28} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>
            Access Restricted
          </h2>
          <p style={{ fontSize: 13, color: "#475569", margin: "0 0 20px" }}>
            You do not have authorization to view or respond to this RFQ. Only invited suppliers with verified credentials can submit quotations.
          </p>
          <button
            type="button"
            className="supplier-btn-action primary"
            onClick={() => navigate("/supplier-rfqs")}
          >
            <ArrowLeft size={13} />
            Back to My RFQs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="supplier-portal-container">
      {/* Top Bar */}
      <div className="supplier-response-top-bar">
        <button
          type="button"
          className="supplier-btn-back"
          onClick={() => navigate("/supplier-rfqs")}
        >
          <ArrowLeft size={13} />
          Back to RFQs
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="supplier-badge-active">
            <Building2 size={13} />
            {activeSupplier?.cr49f_name || "Supplier"}
          </span>
          {response && (
            <span className={`supplier-status-pill ${response.status.toLowerCase()}`}>
              {response.status === "Submitted" ? (
                <CheckCircle2 size={12} />
              ) : response.status === "Draft" ? (
                <Clock size={12} />
              ) : (
                <Mail size={12} />
              )}
              {response.status}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>
          <RefreshCw size={24} className="rfq-spinner" style={{ margin: "0 auto 12px" }} />
          Loading RFQ details and quotation lines...
        </div>
      ) : error && !rfq ? (
        <div style={{ padding: 32, textAlign: "center", color: "#dc2626" }}>
          <AlertCircle size={24} style={{ margin: "0 auto 10px" }} />
          {error}
        </div>
      ) : (
        <div className="supplier-response-view">
          {/* Notifications */}
          {error && (
            <div style={{ padding: 12, background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 8, color: "#b91c1c", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          {successMsg && (
            <div style={{ padding: 12, background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: 8, color: "#065f46", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={15} />
              {successMsg}
            </div>
          )}

          {/* Submitted Banner */}
          {isSubmitted && (
            <div className="supplier-submitted-banner">
              <div className="supplier-submitted-banner-left">
                <div className="supplier-submitted-icon">
                  <Check size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    Quotation Successfully Submitted
                  </div>
                  <div style={{ fontSize: 12.5, opacity: 0.9 }}>
                    Submitted on {response.responseDate ? new Date(response.responseDate).toLocaleString() : "Recently"}. This response is locked for review by the Procurement team.
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
                <Lock size={13} />
                Read-Only
              </div>
            </div>
          )}

          {/* RFQ Metadata Details Card */}
          <div className="supplier-meta-card">
            <div className="supplier-meta-field">
              <span className="supplier-meta-field-label">RFQ Number</span>
              <span className="supplier-meta-field-val" style={{ color: "#2563eb" }}>
                {rfq?.cr49f_rfqnumber || "RFQ"}
              </span>
            </div>

            <div className="supplier-meta-field">
              <span className="supplier-meta-field-label">RFQ Title</span>
              <span className="supplier-meta-field-val">{rfq?.cr49f_rfqtitle || "—"}</span>
            </div>

            <div className="supplier-meta-field">
              <span className="supplier-meta-field-label">Delivery Location</span>
              <span className="supplier-meta-field-val">{rfq?.cr49f_deliverylocation || "Main Tech Hub"}</span>
            </div>

            <div className="supplier-meta-field">
              <span className="supplier-meta-field-label">Submission Deadline</span>
              <span className="supplier-meta-field-val">
                {rfq?.cr49f_submissiondeadline
                  ? new Date(rfq.cr49f_submissiondeadline).toLocaleDateString()
                  : "Open"}
              </span>
            </div>
          </div>

          {/* Scope / Description */}
          {rfq?.cr49f_description && (
            <div style={{ padding: "12px 16px", background: "rgba(241, 245, 249, 0.6)", borderRadius: 8, fontSize: 13, color: "#334155", border: "1px solid #e2e8f0" }}>
              <strong>Scope &amp; Specifications: </strong>
              {rfq.cr49f_description}
            </div>
          )}

          {/* Quotation Editor Card */}
          <div className="supplier-editor-card">
            <div className="supplier-editor-header">
              <div className="supplier-editor-title">
                <Package size={15} color="#2563eb" />
                Quotation Line Items ({lines.length})
              </div>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                {isSubmitted
                  ? "Final submitted prices and specifications"
                  : "Enter unit prices and delivery terms for each requested line item"}
              </span>
            </div>

            {/* Line Items Table */}
            <div className="supplier-table-wrapper" style={{ border: "none" }}>
              <table className="supplier-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Requested Item &amp; Scope</th>
                    <th style={{ width: 100 }}>Req. Qty</th>
                    <th style={{ width: 130 }}>Quoted Unit Price ($)</th>
                    <th style={{ width: 110 }}>Offered Qty</th>
                    <th style={{ width: 150 }}>Lead Time</th>
                    <th>Supplier Comments</th>
                    <th style={{ width: 120, textAlign: "right" }}>Line Total ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={line.id || idx}>
                      <td>{idx + 1}</td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <strong style={{ color: "#0f172a" }}>{line.itemName}</strong>
                          <span style={{ fontSize: 11.5, color: "#64748b" }}>
                            {line.category || "Procurement Item"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <strong style={{ color: "#334155" }}>{line.requestedQuantity}</strong>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="supplier-input-field"
                          placeholder="0.00"
                          value={line.unitPrice === 0 ? "" : line.unitPrice}
                          onChange={(e) => handleLineChange(idx, "unitPrice", e.target.value)}
                          disabled={isSubmitted}
                          style={{ fontWeight: 600 }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          className="supplier-input-field"
                          value={line.offeredQuantity}
                          onChange={(e) => handleLineChange(idx, "offeredQuantity", e.target.value)}
                          disabled={isSubmitted}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="supplier-input-field"
                          placeholder="e.g. 5 days"
                          value={line.leadTime}
                          onChange={(e) => handleLineChange(idx, "leadTime", e.target.value)}
                          disabled={isSubmitted}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="supplier-input-field"
                          placeholder="Notes or model specs..."
                          value={line.comments}
                          onChange={(e) => handleLineChange(idx, "comments", e.target.value)}
                          disabled={isSubmitted}
                        />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <strong style={{ color: "#0f172a", fontSize: 13.5 }}>
                          ${(line.totalPrice || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Commercial Terms Form */}
            <div className="supplier-terms-grid">
              <div className="supplier-term-box">
                <label>Promised Delivery Date</label>
                <input
                  type="date"
                  className="supplier-input-field"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  disabled={isSubmitted}
                />
              </div>

              <div className="supplier-term-box">
                <label>Payment Terms</label>
                <select
                  className="supplier-input-field"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  disabled={isSubmitted}
                >
                  <option value="Net 30">Net 30</option>
                  <option value="Net 15">Net 15</option>
                  <option value="Net 45">Net 45</option>
                  <option value="Net 60">Net 60</option>
                  <option value="Immediate">Immediate / Upon Delivery</option>
                  <option value="50% Advance, 50% on Delivery">50% Advance, 50% on Delivery</option>
                </select>
              </div>

              <div className="supplier-term-box">
                <label>Warranty &amp; Support Terms</label>
                <input
                  type="text"
                  className="supplier-input-field"
                  placeholder="e.g. 1 Year Comprehensive On-site"
                  value={warranty}
                  onChange={(e) => setWarranty(e.target.value)}
                  disabled={isSubmitted}
                />
              </div>
            </div>

            {/* Editor Footer / Actions */}
            <div className="supplier-editor-footer">
              <div className="supplier-total-display">
                <span className="supplier-total-label">Total Quotation Amount</span>
                <span className="supplier-total-amount">
                  ${calculatedTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {!isSubmitted && (
                <div className="supplier-action-buttons">
                  <button
                    type="button"
                    className="supplier-btn-draft"
                    onClick={handleSaveDraft}
                    disabled={savingDraft || submitting}
                  >
                    {savingDraft ? (
                      <>
                        <RefreshCw size={14} className="rfq-spinner" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        Save as Draft
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="supplier-btn-submit"
                    onClick={handleSubmitResponse}
                    disabled={savingDraft || submitting || calculatedTotal <= 0}
                  >
                    {submitting ? (
                      <>
                        <RefreshCw size={14} className="rfq-spinner" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        Submit Response
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierRfqResponsePage;
