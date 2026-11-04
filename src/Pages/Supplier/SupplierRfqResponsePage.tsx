import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  Lock,
  Mail,
  Package,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  Tag,
  Truck,
} from "lucide-react";

import {
  getSupplierRfqDetails,
  saveSupplierResponseDraft,
  submitSupplierResponse,
  calculateLineTotal,
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

  // Commercial terms (Parent response level)
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

      if (res.response.deliveryDate) {
        const d = new Date(res.response.deliveryDate);
        if (!isNaN(d.getTime())) {
          setDeliveryDate(d.toISOString().slice(0, 10));
        } else {
          setDeliveryDate(res.response.deliveryDate);
        }
      }
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

  // Handle line item field edits with immediate recalculation
  const handleLineChange = (
    index: number,
    field: keyof SupplierResponseLineItem,
    value: string | number | boolean
  ) => {
    if (isSubmitted) return;

    setLines((prev) => {
      const updated = [...prev];
      const target = { ...updated[index] };

      if (field === "unitPrice" || field === "offeredQuantity" || field === "discount" || field === "tax" || field === "additionalChargePercentage") {
        const numVal = Math.max(0, Number(value) || 0);
        (target as Record<string, unknown>)[field] = numVal;
      } else if (field === "anyAdditionalCharges") {
        target.anyAdditionalCharges = Boolean(value);
        if (!target.anyAdditionalCharges) {
          target.additionalChargePercentage = 0;
        }
      } else {
        (target as Record<string, unknown>)[field] = value;
      }

      // Re-calculate financial components using the central calculateLineTotal helper
      const calc = calculateLineTotal(
        target.unitPrice,
        target.offeredQuantity,
        target.discount,
        target.tax,
        target.anyAdditionalCharges,
        target.additionalChargePercentage
      );
      target.totalPrice = calc.totalPrice;

      updated[index] = target;
      return updated;
    });
  };

  // Comprehensive Financial Summary (Gross, Discounts, Additional Charges, Taxes, Grand Total)
  const quotationFinancials = useMemo(() => {
    let grossTotal = 0;
    let discountTotal = 0;
    let addlChargesTotal = 0;
    let taxTotal = 0;
    let grandTotal = 0;

    for (const line of lines) {
      const calc = calculateLineTotal(
        line.unitPrice,
        line.offeredQuantity,
        line.discount,
        line.tax,
        line.anyAdditionalCharges,
        line.additionalChargePercentage
      );
      grossTotal += calc.baseAmount;
      discountTotal += calc.discountAmount;
      addlChargesTotal += calc.additionalChargesAmount;
      taxTotal += calc.taxAmount;
      grandTotal += calc.totalPrice;
    }

    return {
      grossTotal: Math.round(grossTotal * 100) / 100,
      discountTotal: Math.round(discountTotal * 100) / 100,
      addlChargesTotal: Math.round(addlChargesTotal * 100) / 100,
      taxTotal: Math.round(taxTotal * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,
    };
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
        anyAdditionalCharges: l.anyAdditionalCharges,
        additionalChargePercentage: l.additionalChargePercentage,
        additionalChargesDetails: l.additionalChargesDetails || l.comments || "",
        leadTime: l.leadTime,
        comments: l.additionalChargesDetails || l.comments,
      }));

      await saveSupplierResponseDraft(response.responseId, formattedLines, {
        deliveryDate,
        paymentTerms,
        warranty,
      });

      setSuccessMsg("Quotation draft saved successfully in Dataverse! You can continue updating anytime.");
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

      // Validation check: Unit Price & Offered Quantity for all lines
      for (const [idx, l] of lines.entries()) {
        if (!l.unitPrice || l.unitPrice <= 0) {
          throw new Error(`Line #${idx + 1} (${l.itemName}) requires a valid quoted unit price greater than $0.`);
        }
        if (!l.offeredQuantity || l.offeredQuantity <= 0) {
          throw new Error(`Line #${idx + 1} (${l.itemName}) requires an offered quantity greater than 0.`);
        }
        if (l.anyAdditionalCharges && l.additionalChargePercentage > 0 && !l.additionalChargesDetails?.trim()) {
          throw new Error(`Line #${idx + 1} has an additional charge of ${l.additionalChargePercentage}%. Please provide description/breakdown in Additional Charges Details.`);
        }
      }

      const formattedLines = lines.map((l) => ({
        id: l.id,
        unitPrice: l.unitPrice,
        offeredQuantity: l.offeredQuantity,
        discount: l.discount,
        tax: l.tax,
        anyAdditionalCharges: l.anyAdditionalCharges,
        additionalChargePercentage: l.additionalChargePercentage,
        additionalChargesDetails: l.additionalChargesDetails || l.comments || "",
        leadTime: l.leadTime,
        comments: l.additionalChargesDetails || l.comments,
      }));

      await submitSupplierResponse(response.responseId, formattedLines, {
        deliveryDate,
        paymentTerms,
        warranty,
      });

      setSuccessMsg("Quotation submitted successfully! The response is now locked and submitted to Procurement.");
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
      {/* Top Bar Navigation */}
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
            {activeSupplier?.cr49f_supplierid1 ? ` (${activeSupplier.cr49f_supplierid1})` : ""}
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
          Loading RFQ details and quotation lines from Dataverse...
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

          {/* Quotation Editor Section */}
          <div className="supplier-editor-card">
            <div className="supplier-editor-header">
              <div className="supplier-editor-title">
                <Package size={15} color="#2563eb" />
                Quotation Line Items ({lines.length})
              </div>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                {isSubmitted
                  ? "Final submitted prices, discounts, taxes, and additional charges"
                  : "Enter unit prices, discounts, tax, and any additional charges per requested item"}
              </span>
            </div>

            {/* Redesigned Rich Line Item Cards */}
            <div className="supplier-line-cards-list">
              {lines.map((line, idx) => {
                const calc = calculateLineTotal(
                  line.unitPrice,
                  line.offeredQuantity,
                  line.discount,
                  line.tax,
                  line.anyAdditionalCharges,
                  line.additionalChargePercentage
                );

                return (
                  <div key={line.id || idx} className="supplier-line-card">
                    {/* Line Card Header */}
                    <div className="supplier-line-card-header">
                      <div className="supplier-line-header-left">
                        <span className="supplier-line-seq-pill">Line #{idx + 1}</span>
                        <h4 className="supplier-line-title">{line.itemName}</h4>
                        <span className="supplier-line-category-pill">
                          <Tag size={11} /> {line.category || "Catalog Item"}
                        </span>
                      </div>

                      <div className="supplier-line-header-right">
                        <span className="supplier-req-qty-badge">
                          Requested Qty: <strong>{line.requestedQuantity}</strong>
                        </span>
                        <div className="supplier-line-total-preview">
                          <span className="supplier-line-total-preview-label">Line Total</span>
                          <span className="supplier-line-total-preview-val">
                            ${calc.totalPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Line Card Body */}
                    <div className="supplier-line-card-body">
                      {/* Grid 1: Basic Pricing & Quantities */}
                      <div className="supplier-pricing-grid">
                        {/* Quoted Unit Price (cr49f_unitprice) */}
                        <div className="supplier-field-group">
                          <label className="supplier-field-label">
                            <span>Quoted Unit Price<span className="supplier-req-star">*</span></span>
                            {calc.baseAmount > 0 && (
                              <span className="supplier-field-calc-hint blue">
                                Gross: ${calc.baseAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </label>
                          <div className="supplier-input-wrap">
                            <span className="supplier-input-prefix">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="supplier-input-field has-prefix"
                              placeholder="0.00"
                              value={line.unitPrice === 0 ? "" : line.unitPrice}
                              onChange={(e) => handleLineChange(idx, "unitPrice", e.target.value)}
                              disabled={isSubmitted}
                              style={{ fontWeight: 600 }}
                            />
                          </div>
                        </div>

                        {/* Offered Quantity (cr49f_quantity) */}
                        <div className="supplier-field-group">
                          <label className="supplier-field-label">
                            <span>Offered Quantity<span className="supplier-req-star">*</span></span>
                            <span style={{ fontSize: 11, color: "#64748b" }}>Req: {line.requestedQuantity}</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            className="supplier-input-field"
                            value={line.offeredQuantity}
                            onChange={(e) => handleLineChange(idx, "offeredQuantity", e.target.value)}
                            disabled={isSubmitted}
                          />
                        </div>

                        {/* Discount % (cr49f_discount) */}
                        <div className="supplier-field-group">
                          <label className="supplier-field-label">
                            <span>Discount (%)</span>
                            {calc.discountAmount > 0 && (
                              <span className="supplier-field-calc-hint green">
                                -${calc.discountAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </label>
                          <div className="supplier-input-wrap">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              className="supplier-input-field has-suffix"
                              placeholder="0"
                              value={line.discount === 0 ? "" : line.discount}
                              onChange={(e) => handleLineChange(idx, "discount", e.target.value)}
                              disabled={isSubmitted}
                            />
                            <span className="supplier-input-suffix">%</span>
                          </div>
                        </div>

                        {/* Tax % (cr49f_tax) */}
                        <div className="supplier-field-group">
                          <label className="supplier-field-label">
                            <span>Tax / GST / VAT (%)</span>
                            {calc.taxAmount > 0 && (
                              <span className="supplier-field-calc-hint amber">
                                +${calc.taxAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </label>
                          <div className="supplier-input-wrap">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              className="supplier-input-field has-suffix"
                              placeholder="0"
                              value={line.tax === 0 ? "" : line.tax}
                              onChange={(e) => handleLineChange(idx, "tax", e.target.value)}
                              disabled={isSubmitted}
                            />
                            <span className="supplier-input-suffix">%</span>
                          </div>
                        </div>
                      </div>

                      {/* Additional Charges Section (cr49f_anyadditionalcharges, cr49f_additionalchargepercentage, cr49f_additionalchargesdetails) */}
                      <div className="supplier-addl-charges-box">
                        <div className="supplier-addl-header-row">
                          <div className="supplier-addl-title">
                            <Truck size={14} color="#d97706" />
                            <span>Additional Charges (Freight, Packaging, Customs, Tooling)</span>
                          </div>

                          <div className="supplier-segmented-toggle">
                            <button
                              type="button"
                              className={`supplier-toggle-btn ${!line.anyAdditionalCharges ? "active" : ""}`}
                              onClick={() => handleLineChange(idx, "anyAdditionalCharges", false)}
                              disabled={isSubmitted}
                            >
                              No (Included)
                            </button>
                            <button
                              type="button"
                              className={`supplier-toggle-btn ${line.anyAdditionalCharges ? "active yes" : ""}`}
                              onClick={() => handleLineChange(idx, "anyAdditionalCharges", true)}
                              disabled={isSubmitted}
                            >
                              Yes (+ Extra Charges)
                            </button>
                          </div>
                        </div>

                        {line.anyAdditionalCharges && (
                          <div className="supplier-addl-fields-grid">
                            <div className="supplier-field-group">
                              <label className="supplier-field-label">
                                <span>Additional Charge (%)<span className="supplier-req-star">*</span></span>
                                {calc.additionalChargesAmount > 0 && (
                                  <span className="supplier-field-calc-hint amber">
                                    +${calc.additionalChargesAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                  </span>
                                )}
                              </label>
                              <div className="supplier-input-wrap">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  className="supplier-input-field has-suffix"
                                  placeholder="e.g. 5"
                                  value={line.additionalChargePercentage === 0 ? "" : line.additionalChargePercentage}
                                  onChange={(e) => handleLineChange(idx, "additionalChargePercentage", e.target.value)}
                                  disabled={isSubmitted}
                                  style={{ fontWeight: 600 }}
                                />
                                <span className="supplier-input-suffix">%</span>
                              </div>
                            </div>

                            <div className="supplier-field-group">
                              <label className="supplier-field-label">
                                <span>Additional Charges Details &amp; Specifications<span className="supplier-req-star">*</span></span>
                              </label>
                              <input
                                type="text"
                                className="supplier-input-field"
                                placeholder="Describe extra charges (e.g., Express shipping & handling, wooden palletizing, insurance, lead time: 5 days...)"
                                value={line.additionalChargesDetails || ""}
                                onChange={(e) => handleLineChange(idx, "additionalChargesDetails", e.target.value)}
                                disabled={isSubmitted}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Live Calculation Math Strip */}
                      <div className="supplier-formula-strip">
                        <span className="supplier-formula-step">
                          Gross: <strong>${calc.baseAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
                        </span>
                        <span className="supplier-formula-arrow">&rarr;</span>
                        <span className="supplier-formula-step">
                          Discount: <strong style={{ color: "#059669" }}>-${calc.discountAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} ({line.discount || 0}%)</strong>
                        </span>
                        <span className="supplier-formula-arrow">&rarr;</span>
                        {line.anyAdditionalCharges && (
                          <>
                            <span className="supplier-formula-step">
                              Addl Chg: <strong style={{ color: "#d97706" }}>+${calc.additionalChargesAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} ({line.additionalChargePercentage || 0}%)</strong>
                            </span>
                            <span className="supplier-formula-arrow">&rarr;</span>
                          </>
                        )}
                        <span className="supplier-formula-step">
                          Tax: <strong style={{ color: "#d97706" }}>+${calc.taxAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} ({line.tax || 0}%)</strong>
                        </span>
                        <span className="supplier-formula-step highlight">
                          Line Total: ${calc.totalPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Commercial Terms Form (Parent Response Level) */}
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
                  <option value="Net 30">Net 30 Days</option>
                  <option value="Net 15">Net 15 Days</option>
                  <option value="Net 45">Net 45 Days</option>
                  <option value="Net 60">Net 60 Days</option>
                  <option value="Immediate">Immediate / Upon Delivery</option>
                  <option value="50% Advance, 50% on Delivery">50% Advance, 50% on Delivery</option>
                </select>
              </div>

              <div className="supplier-term-box">
                <label>Warranty &amp; Support Terms</label>
                <input
                  type="text"
                  className="supplier-input-field"
                  placeholder="e.g. 1 Year Comprehensive On-site + 24/7 Phone Support"
                  value={warranty}
                  onChange={(e) => setWarranty(e.target.value)}
                  disabled={isSubmitted}
                />
              </div>
            </div>

            {/* Financial Summary & Actions Card */}
            <div className="supplier-quote-summary-card">
              <div className="supplier-quote-summary-breakdown">
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <DollarSign size={14} color="#2563eb" />
                  Quotation Financial Breakdown
                </div>
                <div className="supplier-summary-row">
                  <span>Gross Subtotal ({lines.length} items)</span>
                  <strong>${quotationFinancials.grossTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
                </div>
                {quotationFinancials.discountTotal > 0 && (
                  <div className="supplier-summary-row" style={{ color: "#059669" }}>
                    <span>Total Discounts Deducted</span>
                    <strong>-${quotationFinancials.discountTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
                  </div>
                )}
                {quotationFinancials.addlChargesTotal > 0 && (
                  <div className="supplier-summary-row" style={{ color: "#d97706" }}>
                    <span>Total Additional Charges (Freight, Handling, etc.)</span>
                    <strong>+${quotationFinancials.addlChargesTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
                  </div>
                )}
                {quotationFinancials.taxTotal > 0 && (
                  <div className="supplier-summary-row" style={{ color: "#d97706" }}>
                    <span>Total Estimated Taxes</span>
                    <strong>+${quotationFinancials.taxTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
                  </div>
                )}
                <div className="supplier-summary-row total">
                  <span>Grand Total Quotation Amount</span>
                  <span className="supplier-grand-total">
                    ${quotationFinancials.grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
                {!isSubmitted ? (
                  <>
                    <button
                      type="button"
                      className="supplier-btn-submit"
                      onClick={handleSubmitResponse}
                      disabled={savingDraft || submitting || quotationFinancials.grandTotal <= 0}
                      style={{ padding: "12px 20px", fontSize: 13.5, justifyContent: "center" }}
                    >
                      {submitting ? (
                        <>
                          <RefreshCw size={15} className="rfq-spinner" />
                          Submitting Quotation...
                        </>
                      ) : (
                        <>
                          <Send size={15} />
                          Submit Response
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="supplier-btn-draft"
                      onClick={handleSaveDraft}
                      disabled={savingDraft || submitting}
                      style={{ padding: "10px 18px", justifyContent: "center" }}
                    >
                      {savingDraft ? (
                        <>
                          <RefreshCw size={14} className="rfq-spinner" />
                          Saving Draft...
                        </>
                      ) : (
                        <>
                          <Save size={14} />
                          Save as Draft
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: 12, background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 8, color: "#065f46" }}>
                    <CheckCircle2 size={20} style={{ margin: "0 auto 6px" }} />
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Quotation Submitted</div>
                    <div style={{ fontSize: 11.5, color: "#475569", marginTop: 2 }}>Locked in Dataverse</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierRfqResponsePage;
